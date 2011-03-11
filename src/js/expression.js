//
// script.js - Contains script related functions
//

DJS.Expression = Class.create( DJS.Base, {
  initialize: function( parent ) {
    this.list = [];
    this.startToken = null;
    this.endToken = null;
    this.parent = parent;
  },
  parse: function( source ) {
    var token;
    var firstToken;
    
    do {
      if( token != null ) {
        this.startToken = firstToken = source.getToken();
      } else {
        firstToken = source.peekToken();
      }
      
      var assignmentExpression = new DJS.AssignmentExpression( this );
      assignmentExpression = assignmentExpression.parse( source );
      
      assignmentExpression.startToken = firstToken;
      assignmentExpression.endToken = source.currentToken();
      this.list.push( assignmentExpression );
      token = source.peekToken();
      
    } while( token.value == "," );
    
    this.endToken = token;
    return this.setupParent( this.list.length == 1 ? this.list[0] : this );
  },
  doStep: function( context, op ) {
    if( this.step( context, op ) ) {
      context.markNodeComplete( this );
      return true;
    }
    
    return false;
  },
  beforeExecute: function( context ) {
    context.addNodeState( this, { 'idx': -1, 'value': [] } );
  },
  step: function( context, op ) {
    var state = context.getNodeState( this );
    var idx = state.idx;
    var expr;
    if( idx == -1 || context.isNodeComplete( this.list[idx] ) ) {
      if( idx != -1 ) {
        state.value.push( context.getNodeState( this.list[idx] ).value );
        this.list[idx].afterExecute( context );
      }
      context.addNodeState( this, 'idx', ++idx );
      if( idx == this.list.length ) return true;
      expr = this.list[idx];
      expr.beforeExecute( context );
    } else {
      expr = this.list[idx];
    }
    
    // node execute
    if( !expr.doStep( context, op ) ) {
      return false;
    }
    
    if( idx + 1 == this.list.length ) {
      expr.afterExecute( context );
      return true;
    }
    
    return false;
  },
  afterExecute: function( context ) {
    context.removeNodeState( this );
  },
  setupParent: function( expr ) {
    expr.parent = this.parent;
    return expr;
  },
  toString: function() {
    return this.list.join( ", " );
  },
  toDebugString: function() {
    return this.startToken.toString() + ", " + this.endToken.toString();
  }
});

DJS.LeftsideRightsideExpression = Class.create( DJS.Expression, {
  beforeExecute: function( context ) {
    context.addNodeState( this, { step: -1 } );
  },
  step: function( context, op ) {
    var state = context.getNodeState( this );
    var step = state.step;
    
    if( step == -1 ) {
      this.leftOperand.beforeExecute( context );
      context.addNodeState( this, 'step', ++step );
    }
    
    // left operand
    
    if( step == 0 ) {
      var flag = this.leftOperand.doStep( context, op );
      if( flag ) {
        var lstate = context.getNodeState( this.leftOperand );
        context.addNodeState( this, { 'name': lstate.name, 
          'container': lstate.container, 'ls': lstate.value, 'step': ++step } );
        this.leftOperand.afterExecute( context );
        if( !this.rightOperand ) return true;
        this.rightOperand.beforeExecute( context );
      }
      return false;
    }
    
    // right operand
    
    if( step == 1 ) {
      var flag = this.rightOperand.doStep( context, op );
      if( flag ) {
        context.addNodeState( this, { 'rs': context.getNodeState( this.rightOperand ).value, 'step': ++step } );
        this.rightOperand.afterExecute( context );
      }
      
      return false;
    }
    
    // operator
    
    if( step == 2 ) {
      var ret;
      var ls = state.ls;
      ret = this.performOp( this.operator, ls, state.rs );
      if(state.name && state.container && this.isAssignment) {
        context.setVariable( state.container, state.name, ret );
      }
      context.addNodeState( this, 'value', ret );
      return true;
    }
  },
});
DJS.AssignmentExpression = Class.create( DJS.LeftsideRightsideExpression, {
  initialize: function( $super, parent ) {
    $super( parent );
    this.isAssignment = true;
  },
  parse: function( source ) {
    this.leftOperand = new DJS.ConditionalExpression( this );
    this.leftOperand = this.leftOperand.parse( source );
    
    // Peek at the next token. If we encounter an assignment operator, then we know
    // we're going to have a right operand.
    var token = source.peekToken();
    
    switch( token.value ) {
      case "=":
      case "+=":
      case "-=":
      case "*=":
      case "/=":
      case "%=":
      case ">>=":
      case "<<=":
      case ">>>=":
      case "&=":
      case "|=":
      case "^=":
        this.operator = token
        break;
      
      default:
        return this.setupParent( this.leftOperand );
    }
    
    this.operator = source.getToken().value;
    
    this.rightOperand = new DJS.AssignmentExpression( this );
    this.rightOperand = this.rightOperand.parse( source );
    
    return this;
  },
  
  performOp: function( op, ls, rs ) {
    switch( op ) {
      case "=":   ls = rs;
              break;
      case "+=":    ls += rs;
              break;
      case "-=":    ls -= rs;
              break;
      case "*=":    ls *= rs;
              break;
      case "/=":    ls /= rs;
              break;
      case "%=":    ls %= rs;
              break;
      case ">>=":   ls >>= rs;
              break;
      case "<<=":   ls <<= rs;
              break;
      case ">>>=":  ls >>>= rs;
              break;
      case "&=":    ls &= rs;
              break;
      case "|=":    ls |= rs;
              break;
      case "^=":    ls ^= rs;
              break;
    }
    return ls;
  },
  
  toString: function() {
    var ret = this.leftOperand.toString();
    if( this.rightOperand == null ) {
      return ret;
    }
    
    ret += " " + this.operator + " ";
    ret += this.rightOperand.toString();
    
    return ret;
  }
});

DJS.ExpressionOperationList = Class.create( DJS.Expression, {
  initialize: function( $super, parent ) {
    $super( parent );
    this.operands = [];
  },
  beforeExecute: function( context ) {
    context.addNodeState( this, { idx: -1, value: 0 } );
  },
  step: function( context, op ) {
    var state = context.getNodeState( this );
    var idx = state.idx;
    var expr;
    
    // node switch
    if( idx == -1 || context.isNodeComplete( this.operands[idx] ) ) {
      if( idx != -1 ) {
        var newVal = context.getNodeState( this.operands[ idx ] ).value;
        this.operands[ idx ].afterExecute( context );
        if( state.lastOp ) {
          state.value = this.performOp( state.lastOp, state.value, newVal );
        } else {
          state.value = newVal
        }
      }
      context.addNodeState( this, 'idx', ++idx );
      if( idx >= this.operands.length ) return true;
      
      // capture op
      if( idx % 2 == 1 ) { 
        context.addNodeState( this, { 'lastOp': this.operands[idx], idx : ++idx } );
      }
      
      expr = this.operands[idx];
      expr.beforeExecute( context );
    } else {
      expr = this.operands[idx];
    }
    
    // node execute
    if( !expr.doStep( context, op ) ) {
      return false;
    }
        
    return false;
  },
});
DJS.AdditiveExpression = Class.create( DJS.ExpressionOperationList, {
  initialize: function( $super, parent ) {
    $super( parent );
    this.operands = [];
  },
  parse: function($super, source) {
    var operand = new DJS.MultiplicativeExpression( this );
    operand = operand.parse( source );
    this.operands.push( operand );
    
    while( true ) {
      switch( source.peekToken().value ) {
        case '+':
        case '-':   this.operands.push( source.getToken().value );
                break;
      
        default:    return this.setupParent( this.operands.length == 1 ? this.operands[0] : this );
      }
      
      operand = new DJS.MultiplicativeExpression( this );
      operand = operand.parse( source );
      this.operands.push( operand );
    }
    
    return this.setupParent( this.operands.length == 1 ? this.operands[0] : this );
  },
  performOp: function( op, ls, rs ) {
    switch( op ) {
    case '+':
      ls += rs;
      break;
    case '-':
      ls -= rs;
      break;
    }
    return ls;
  },
  toString: function() {
    return this.operands.join(" ");
  }
});

DJS.ArrayLiteralExpression = Class.create( DJS.Expression, {
  initialize: function( $super, parent ) {
    $super( parent );
  },
  parse: function($super, source) {
    var token = source.getToken();
    if( token.value != '[' ) {
      throw new DJS.ExceptionNotExpecting( '[', token, source );
    }
    
    $super( source );
    
    token = source.getToken();
    if( token.value != ']' ) {
      throw new DJS.ExceptionNotExpecting( ']', token, source );
    }
    
    return this;
  },
  step: function( $super, context, op ) {
    return $super( context, op );
  },
  toString: function() {
    return "[ " + $super() + " ]";
  }
});

DJS.BitwiseAndExpression = Class.create( DJS.ExpressionOperationList, {
  initialize: function( $super, parent ) {
    $super( parent );
    this.operands = [];
  },
  parse: function($super, source) {
    var operand = new DJS.EqualityExpression( this );
    operand = operand.parse( source );
    this.operands.push( operand );

    while( true ) {
      if( source.peekToken().value != "&" ) {
        return this.setupParent( this.operands.length == 1 ? this.operands[0] : this );
      } else {
        this.operands.push( "&" );
      }

      operand = new DJS.EqualityExpression( this );
      operand = operand.parse( source );
      this.operands.push( operand );
    }
    
    return this.setupParent( this.operands.length == 1 ? this.operands[0] : this );
  },
  performOp: function( op, ls, rs ) {
    return ls & rs;
  },
  toString: function() {
    return this.operands.join(" ");
  }
});

DJS.BitwiseOrExpression = Class.create( DJS.ExpressionOperationList, {
  initialize: function( $super, parent ) {
    $super( parent );
    this.operands = [];
  },
  parse: function($super, source) {
    var operand = new DJS.BitwiseXORExpression( this );
    operand = operand.parse( source );
    this.operands.push( operand );

    while( true ) {
      if( source.peekToken().value != "|" ) {
        return this.setupParent( this.operands.length == 1 ? this.operands[0] : this );
      } else {
        this.operands.push( "|" );
      }

      operand = new DJS.BitwiseXORExpression( this );
      operand = operand.parse( source );
      this.operands.push( operand );
    }
    
    return this.setupParent( this.operands.length == 1 ? this.operands[0] : this );
  },
  performOp: function( op, ls, rs ) {
    return ls | rs;
  },
  toString: function() {
    return this.operands.join(" ");
  }
});

DJS.BitwiseXORExpression = Class.create( DJS.ExpressionOperationList, {
  initialize: function( $super, parent ) {
    $super( parent );
    this.operands = [];
  },
  parse: function($super, source) {
    var operand = new DJS.BitwiseAndExpression( this );
    operand = operand.parse( source );
    this.operands.push( operand );

    while( true ) {
      if( source.peekToken().value != "^" ) {
        return this.setupParent( this.operands.length == 1 ? this.operands[0] : this );
      } else {
        this.operands.push( "^" );
      }

      operand = new DJS.BitwiseAndExpression( this );
      operand = operand.parse( source );
      this.operands.push( operand );
    }
    
    return this.setupParent( this.operands.length == 1 ? this.operands[0] : this );
  },
  performOp: function( op, ls, rs ) {
    return ls ^ rs;
  },
  canStepIn: function( context ) {
    this.operands.slice(  )
  },
  getState: function( context ) {
    if(!context.hasNodeState(this)) {
      return { idx: 0 };
    }
  },
  toString: function() {
    return this.operands.join(" ");
  }
});

DJS.ConditionalExpression = Class.create( DJS.Expression, {
  initialize: function( $super, parent ) {
    $super( parent );
  },
  parse: function($super, source) {
    this.condition = new DJS.LogicalOrExpression( this );
    this.condition = this.condition.parse( source );
    
    // If we don't encounter a question mark, we know that we haven't hit a tertiary 
    // conditional, so return
    
    var token = source.peekToken();
    if( token.value != '?' ) {
      return this.setupParent( this.condition );
    }
    
    source.getToken(); // move forward by a token
    
    this.thenExpression = new DJS.AssignmentExpression( this );
    this.thenExpression = this.thenExpression.parse( source );
    
    // Attempt to match the colon
    
    var token = source.getToken();
    
    if( token.value != ':' ) {
      throw new DJS.ExceptionNotExpecting( ':', token, source );
    }
    
    this.elseExpression = new DJS.AssignmentExpression( this );
    this.elseExpression = this.elseExpression.parse( source );
    
    return this;
  },
  beforeExecute: function( context ) {
    context.addNodeState( this, { step: -1 } );
  },
  step: function( context, op ) {
    var state = context.getNodeState( this );
    var step = state.step;
    
    if( step == -1 ) {
      this.condition.beforeExecute( context );
      step = ++state.step;
    }
    
    if( step == 0 ) {
      if( !this.condition.doStep( context, op ) ) {
        return false;
      }
      
      state.condition = context.getNodeState( this.condition ).value;
      this.condition.afterExecute( context );
      step = ++state.step;
      return false;
    }
    
    if( step == 1 ) {
      var expr = state.condition ? this.thenExpression : this.elseExpression;
      if( !expr.doStep( context, op ) ) {
        return false;
      }
      
      state.value = context.getNodeState( expr ).value;
      expr.afterExecute( context );
      return true;
    }
  },
  toString: function() {
    var ret = this.condition.toString();
    if(!this.thenExpression) return ret;
    return ret + " ? " + this.thenExpression.toString() + " : " + this.elseExpression.toString();
  }
});

DJS.ConstantExpression = Class.create( DJS.Expression, {
  initialize: function( $super, parent ) {
    $super( parent );
  },
  parse: function($super, source) {
    var token = source.getToken();
    switch( token.type ) {
      case DJS.Token.FLOAT_LITERAL:
      case DJS.Token.INTEGER_LITERAL:
      case DJS.Token.STRING_LITERAL:
      case DJS.Token.NULL_LITERAL:
      case DJS.Token.BOOLEAN_LITERAL:
      case DJS.Token.UNDEFINED_LITERAL:
      case DJS.Token.NAN_LITERAL:
      case DJS.Token.INFINITY_LITERAL:
        this.value = token.value;
        break;
        
      default:
        throw new DJS.ExceptionNotExpecting( "a literal value", token, source );
    }
    
    this.startToken = this.endToken = token;
    return this;
  },
  step: function( context, op ) {
    context.addNodeState( this, 'value', this.value );
    return true;
  },
  canStepIn: function( context ) {
    return false;
  },
  toString: function() {
    return typeof( this.value ) == "string" ? "\"" + this.value + "\"" : this.value.toString();
  }
});

DJS.EncapsulatedExpression = Class.create( DJS.Expression, {
  initialize: function( $super, parent ) {
    $super( parent );
    this.innerExpression = new DJS.Expression( this );
  },
  parse: function($super, source) {
    var token = source.getToken();
    if( token.value != '(' ) {
      throw new DJS.ExceptionNotExpecting( '(', token, source );
    }
    
    this.innerExpression = this.innerExpression.parse( source );
    
    var token = source.getToken();
    if( token.value != ')' ) {
      throw new DJS.ExceptionNotExpecting( ')', token, source );
    }
    
    return this;
  },
  step: function( context, op ){
    return this.innerExpression.doStep( context, op );
  },
  toString: function() {
    return "(" + this.innerExpression.toString() + ")";
  }
});

DJS.EqualityExpression = Class.create( DJS.LeftsideRightsideExpression, {
  initialize: function( $super, parent ) {
    $super( parent );
  },
  parse: function($super, source) {
    this.leftOperand = new DJS.RelationalExpression( this );
    this.leftOperand = this.leftOperand.parse( source );
    
    var token = source.peekToken();
    
    switch( token.value ) {
      case "==":
      case "!=":
      case "===":
      case "!==":
        break;
      default:
        return this.setupParent( this.leftOperand );
    }
    
    this.operator = source.getToken().value; // grab operator
    
    this.rightOperand = new DJS.RelationalExpression( this );
    this.rightOperand = this.rightOperand.parse( source );
    
    return this;
  },
  performOp: function( op, ls, rs ) {
    switch( op ) {
      case "==":
        return ls == rs;
      case "!=":
        return ls != rs;
      case "===":
        return ls === rs;
      case "!==":
        return ls !== rs;
    }
  },
  toString: function() {
    var ret = this.leftOperand.toString();
    if( this.rightOperand == null ) {
      return ret;
    }
    
    ret += " " + this.operator + " ";
    ret += this.rightOperand.toString();
    
    return ret;
  }
});

DJS.FunctionExpression = Class.create( DJS.Expression, {
  initialize: function( $super, parent ) {
    $super( parent );
    this.args = [];
    this.block = new DJS.BlockStatement( this );
  },
  parse: function($super, source) {
    var token = source.getToken();
    if( token.value != "function" ) {
      throw new DJS.ExceptionNotExpecting( "function", token, source );
    }
    
    token = source.getToken();
    if( token.value != "(" ) {
      throw new DJS.ExceptionNotExpecting( "(", token, source );
    }
    
    if( source.peekToken().value != ')' ) {
      do {      
        token = source.getToken();
        if( token.type != DJS.Token.IDENTIFIER ) {
          throw new DJS.ExceptionNotExpecting( "identifier", token, source );
        }
      
        this.args.push( token.value );
      
        token = source.peekToken();
        
        if( token.value == ':' ) { // type specifier
          source.getToken();
          ( new DJS.IdentifierExpression() ).parse( source );
        }
        else if( token.value == ',' ) { // delimiter
          source.getToken();
        }
        else if( token.value == ')' ) { // close args
          break;
        }
        else {
          throw new DJS.ExceptionNotExpecting( ', or )', token, source );
        }
      }
      while( true );
    }
    
    token = source.getToken();
    if( token.value != ")" ) {
      throw new DJS.ExceptionNotExpecting( ")", token, source );
    }
    
    //
    // Return type specifier
    //
    if( source.peekToken().value == ':' ) {
      source.getToken();
      ( new DJS.IdentifierExpression() ).parse( source );
    }
    
    
    this.block.parse( source );
  },
  canStepIn: function( context ) {
    return false;
  },
  toString: function() {
    return "function( " + this.args.join(", ") + " ) " + this.block.toString();
  }
});

DJS.IdentifierExpression = Class.create( DJS.Expression, {
  initialize: function( $super, parent ) {
    $super( parent );
    this.arrayExpressions = []; 
    this.isArrayAccess = false;
    this.isMethodCall = false;
  },
  parse: function($super, source) {
    var token = source.getToken();
    if( token.type != DJS.Token.IDENTIFIER && token.value != "this" && token.value != "super" ) {
      throw new DJS.ExceptionNotExpecting( 'identifier', token, source );
    }
    
    this.identifier = token.value;
    
    //
    // Parse array access jiggers
    //  
    token = source.peekToken();
    if( token.value == '[' ) {
      this.parseArrayAccess( source );
    }
    
    //
    // Parse method call
    //
    token = source.peekToken();
    if( token.value == '(' ) {
      this.parseMethodCall( source );
    }
    
    //
    // See if we have any sub-identifiers
    //
    token = source.peekToken();
    if( token.value == '.' ) {
      source.getToken(); // skip past dot
      this.subIdentifier = new DJS.IdentifierExpression( this );
      this.subIdentifier = this.subIdentifier.parse( source );
    }
    
    return this;
  },
  parseArrayAccess: function( source ) {
    var expr;
    this.isArrayAccess = true;
    
    while( source.peekToken().value == '[' ) {
      source.getToken(); // skip past open square bracket
      
      //
      // parse expression
      //
      this.arrayExpressions.push( expr = (new DJS.Expression( this )).parse( source ) );
      
      //
      // parse closing bracket
      //
      var token = source.getToken();
      if( token.value != ']' ) {
        throw new DJS.ExceptionNotExpecting( ']', token, source );
      }           
    }
  },
  parseMethodCall: function( source ) {
    this.isMethodCall = true;
    
    var token = source.getToken();
    if( token.value != '(' ) {
      throw new DJS.ExceptionNotExpecting( '(', token, source );
    }
    
    token = source.peekToken();
    if( token.value != ")" && token.type != DJS.Token.PUNCTUATOR ) {
      this.methodArguments = new DJS.Expression( this );
      this.methodArguments = this.methodArguments.parse( source );
    }
    
    token = source.getToken();
    if( token.value != ')' ) {
      throw new DJS.ExceptionNotExpecting( ')', token, source );
    }
  },
  beforeExecute: function( context, scope ) {
    context.addNodeState( this, { step: 0, idx: -1 } );
    this.contextScope = scope;
  },
  step: function( context, op ) {
    var state = context.getNodeState( this );
    var step = state.step;
    var idx = state.idx;
    
    // Identifier
    
    if( step == 0 ) {
      var variable = this.contextScope ? { name: this.identifier, container: this.contextScope, value: this.contextScope[ this.identifier ] } 
        : context.getVariable( this.identifier, true );
      
      context.addNodeState( this,
        { name: variable.name, container: variable.container, value: variable.value } );
      state.step++;
      return !this.isArrayAccess && !this.isMethodCall && !this.subIdentifier;
    }
    
    // Array Access
    
    if( step == 1 && !this.isArrayAccess ) {
      step = ++state.step;
    }
    
    if( step == 1 ) {
      var expr;
      if( idx == -1 ) {
        expr = this.arrayExpressions[ idx = ++state.idx ];
        expr.beforeExecute( context );
      } else {
        expr = this.arrayExpressions[ state.idx ];
      }
      
      if( context.isNodeComplete( expr ) ) {
        var val = context.getNodeState( expr ).value;
        expr.afterExecute( context );
        context.addNodeState( this, { name: val, container: state.value, value: state.value[ val ] } );
        idx = ++state.idx;
        if( idx == this.arrayExpressions.length ) {
          state.idx = -1;
          state.step = 2;
          return !this.isMethodCall && !this.subIdentifier;
        }
        expr = this.arrayExpressions[ idx ];
        expr.beforeExecute( context );
      }
      
      if( expr.doStep( context, op ) ) {
        return false;
      }
    }
    
    // Method Calls
    
    if( step == 2 && !this.isMethodCall ) {
      step = ++state.step;
    }
    
    if( step == 2 ) {
      var expr = this.methodArguments;
      
      if( state.idx == -1 && expr ) {
        expr.beforeExecute( context );
        state.idx++;
      }
      
      if( !expr || context.isNodeComplete( expr ) ) {
        state.args = expr ? context.getNodeState( expr ).value : [];
        if( !Object.isArray( state.args ) ) state.args = [ state.args ];

        if(expr) expr.afterExecute( context );          
        state.step = 3;
        state.idx = -1;
        if( this.isConstructor ) {
          context.addNodeState( this, { value: state.value, args: state.args } );
        } else {
          context.addNodeState( this, { value: state.value.apply( state.container, state.args ) } );
        }
        
        if( !this.subIdentifier ) {
          return true;
        }
        return false;
      }
      
      expr.doStep( context, op );
      return false;
    }
    
    // Sub Identifier
    
    if( step == 3 && !this.subIdentifier ) {
      return true;
    }
    
    if( step == 3 ) {
      if( state.idx == -1 ) {
        this.subIdentifier.beforeExecute( context, state.value );
        state.idx = 0;
      }
      
      if( this.subIdentifier.doStep( context, op ) ) {
        state.value = context.getNodeState( this.subIdentifier ).value;
        this.subIdentifier.afterExecute( context );
        return true;
      }
      return false;
    }
    
    return true;
  },
  toString: function() {
    var ret = this.identifier;
    
    if( this.isArrayAccess ) {
      var len = this.arrayExpressions.length;
      for( var i = 0; i < len; i++ ) {
        ret += "[ " + this.arrayExpressions[i].toString() + " ]"
      }
    }
    
    if( this.isMethodCall ) {
      ret += "(" + ( this.methodArguments == null ? "" : " " + this.methodArguments.toString() + " " ) + ")"
    }
    
    if( this.subIdentifier != null ) {
      ret += "." + this.subIdentifier.toString();
    }
    
    return ret;
  }
});

DJS.LogicalAndExpression = Class.create( DJS.ExpressionOperationList, {
  initialize: function( $super, parent ) {
    $super( parent );
    this.operands = [];
  },
  parse: function($super, source) {
    var operand = new DJS.BitwiseOrExpression( this );
    operand = operand.parse( source );
    this.operands.push( operand );

    while( true ) {
      if( source.peekToken().value != "&&" ) {
        return this.setupParent( this.operands.length == 1 ? this.operands[0] : this );
      } else {
        this.operands.push( "&&" );
      }

      operand = new DJS.BitwiseOrExpression( this );
      operand = operand.parse( source );
      this.operands.push( operand );
    }
    
    return this.setupParent( this.operands.length == 1 ? this.operands[0] : this );
  },
  performOp: function( op, ls, rs ) {
    return ls && rs;
  },
  toString: function() {
    return this.operands.join(" ");
  }
});

DJS.LogicalOrExpression = Class.create( DJS.ExpressionOperationList, {
  initialize: function( $super, parent ) {
    $super( parent );
    this.operands = [];
  },
  parse: function($super, source) {
    var operand = new DJS.LogicalAndExpression( this );
    operand = operand.parse( source );
    this.operands.push( operand );

    while( true ) {
      if( source.peekToken().value != "||" ) {
        return this.setupParent( this.operands.length == 1 ? this.operands[0] : this );
      } else {
        this.operands.push( "||" );
      }

      operand = new DJS.LogicalAndExpression( this );
      operand = operand.parse( source );
      this.operands.push( operand );
    }
    
    return this.setupParent( this.operands.length == 1 ? this.operands[0] : this );
  },  
  performOp: function( op, ls, rs ) {
    return ls || rs;
  },
  toString: function() {
    return this.operands.join(" ");
  }
});


DJS.MultiplicativeExpression = Class.create( DJS.ExpressionOperationList, {
  initialize: function( $super, parent ) {
    $super( parent );
    this.operands = [];
  },
  parse: function($super, source) {
    var operand = new DJS.UnaryExpression( this );
    operand = operand.parse( source );
    this.operands.push( operand );
    
    while( true ) {
      switch( source.peekToken().value ) {
        case '*':
        case '/':   operands.push( source.getToken().value );
                break;
      
        default:    return this.setupParent( this.operands.length == 1 ? this.operands[0] : this );
      }
      
      operand = new DJS.UnaryExpression( this );
      operand = operand.parse( source );
      this.operands.push( operand );
    }
    
    return this.setupParent( this.operands.length == 1 ? this.operands[0] : this );
  },
  performOp: function( op, ls, rs ) {
    if( op == '*' ) {
      return ls * rs;
    } 
    else if( op == '/' ) {
      return ls / rs;
    }
  },
  toString: function() {
    return this.operands.join(" ");
  }
});

DJS.NewExpression = Class.create( DJS.Expression, {
  initialize: function( $super, parent ) {
    $super( parent );
    this.constructorExpr = new DJS.PostfixExpression( this );
  },
  parse: function($super, source) {
    var token = source.getToken();
    
    if( token.value != "new" || token.type != DJS.Token.RESERVED_WORD ) {
      throw new DJS.ExceptionNotExpecting( 'new', token, source );
    }
    
    this.constructorExpr = this.constructorExpr.parse( source );
    
    return this;
  },
  beforeExecute: function( context ) {
    context.addNodeState( this, { step: -1 } );
    this.constructorExpr.isConstructor = true;
  },
  step: function( context, op ) {
    var state = context.getNodeState( this );
    var step = state.step;
    
    if( step == -1 ) {
      this.constructorExpr.beforeExecute( context );
      step = ++state.step;
    }
    
    if( step == 0 ) {
      if( !this.constructorExpr.doStep( context, op ) ) {
        return false;
      }
      
      var constState = context.getNodeState( this.constructorExpr );
      var constFunc = constState.value;
      var constArgs = constState.args;
      this.constructorExpr.afterExecute( context );
      
      var instance = {};
      instance.__proto__ = constFunc.prototype;
      instance.__constructor__ = constFunc;
      constFunc.apply( instance, constArgs );
      state.value = instance;
      
      return true;
    }
  },
  toString: function() {
    return "new " + this.constructorExpr.toString();
  }
});

DJS.ObjectLiteralExpression = Class.create( DJS.Expression, {
  initialize: function( $super, parent ) {
    $super( parent );
    this.value = {};
  },
  parse: function($super, source) {
    var token = source.getToken();
    if( token.value != '{' ) {
      throw new DJS.ExceptionNotExpecting( '{', token, source );
    }
    
    while( ( token = source.getToken() ).type == DJS.Token.IDENTIFIER || token.type == DJS.Token.INTEGER_LITERAL ) {
      var name = token.value;
      token = source.getToken();
      if( token.value != ':') {
        throw new DJS.ExceptionNotExpecting( ':', token, source );
      }
      
      // get the expression
      var expression = new DJS.AssignmentExpression( this );
      expression = expression.parse( source );
      this.value[ name ] = expression;

      // comma? 
      token = source.peekToken();
      if( token.value != ',' ) {
        break;
      }
      source.getToken(); // skip past comma
    }
    
    var token = source.getToken();
    if( token.value != '}' ) {
      throw new DJS.ExceptionNotExpecting( '}', token, source );
    }
    
    return this;
  },
  beforeExecute: function( context ) {
    var keys = [];
    for( var k in this.value ) {
      keys.push( k );
    }
    context.addNodeState( this, { value: {}, keys: keys, idx: -1 } );
    
  },
  step: function( context, op ) {
    var state = context.getNodeState( this );
    var keys = state.keys;
    var idx = state.idx;
    var value = state.value;
    var expr;
    
    if( idx == -1 || context.isNodeComplete( this.value[keys[idx]] ) ) {
      if( idx != -1 ) { 
        value[keys[idx]] = context.getNodeState( this.value[keys[idx]] ).value;
        this.value[keys[idx]].afterExecute( context );
      }
      idx = ++state.idx;
      if( idx >= keys.length ) return true;
      expr = this.value[keys[idx]];
      expr.beforeExecute( context );
    } else {
      expr = this.value[keys[idx]];
    }
    
    // node execute
    if( !expr.doStep( context, op ) ) {
      return false;
    }
        
    return false;
  },
  toString: function() {
    var ret = "{ ";
    var comma = "";
    for( var k in this.value ) {
      ret += comma + k + ": " + this.value[k].toString();
      comma = ", ";
    }
    ret += " }";
    
    return ret;
  }
});

DJS.PostfixExpression = Class.create( DJS.Expression, {
  initialize: function( $super, parent ) {
    $super( parent );
  },
  parse: function($super, source) {
    this.operand = new DJS.PrimaryExpression( this );
    this.operand = this.operand.parse( source );
    
    var token = source.peekToken();
    
    switch( token.value ) {
      case "++":
      case "--":      this.operator = source.getToken().value;
                break;
      default:      return this.setupParent( this.operand );
    }
    
    return this;
  },
  beforeExecute: function( context ) {
    context.addNodeState( this, { step: -1 } );
  },
  step: function( context, op ) {
    var state = context.getNodeState( this );
    var step = state.step;
    
    if( step == -1 ) {
      this.operand.beforeExecute( context );
      step = ++state.step;
    }
    
    if( step == 0 ) {
      if( !this.operand.doStep( context, op ) ) {
        return false;
      }
      
      var opState = context.getNodeState( this.operand );
      state.value = opState.value;
      state.step++;
      return false;
    }
    
    if( step == 1 ) {
      var opState = context.getNodeState( this.operand );
      switch( this.operator ) {
        case "++":
          context.setVariable( opState.container, opState.name, state.value + 1 );
          break;
          
        case "--":
          context.setVariable( opState.container, opState.name, state.value - 1 );
          break;
      }
      
      return true;
    }
  },
  toString: function() {
    return this.operand.toString() + (this.operator == null ? "" : this.operator);
  }
});

DJS.PrimaryExpression = Class.create( DJS.Expression, {
  initialize: function( $super, parent ) {
    $super( parent );
  },
  parse: function($super, source) {
    var token = source.peekToken();
    
    switch( token.type ) {
      case DJS.Token.IDENTIFIER:
        this.operand = new DJS.IdentifierExpression( this );
        this.operand = this.operand.parse( source );
        break;
        
      case DJS.Token.RESERVED_WORD:
        if( token.value == "new" ) {
          this.operand = new DJS.NewExpression( this );
          this.operand = this.operand.parse( source );
        }
        else if( token.value == "var" ) {
          this.operand = new DJS.VariableDeclarationExpression( this );
          this.operand = this.operand.parse( source );
        }
        else if( token.value == "function" ) {
          this.operand = new DJS.FunctionExpression( this );
          this.operand = this.operand.parse( source );
        }
        else if( token.value == "this" || token.value == "super" ) {
          this.operand = new DJS.IdentifierExpression( this );
          this.operand = this.operand.parse( source );
        }
        break;
      
      case DJS.Token.FLOAT_LITERAL:
      case DJS.Token.INTEGER_LITERAL:
      case DJS.Token.STRING_LITERAL:
      case DJS.Token.NULL_LITERAL:  
      case DJS.Token.BOOLEAN_LITERAL:
      case DJS.Token.UNDEFINED_LITERAL:
      case DJS.Token.NULL_LITERAL:
      case DJS.Token.NAN_LITERAL:
        this.operand = new DJS.ConstantExpression( this );
        this.operand = this.operand.parse( source );
        break;
        
      case DJS.Token.PUNCTUATOR:
        if( token.value == '{' ) {
          this.operand = new DJS.ObjectLiteralExpression( this );
        }
        else if( token.value == '[' ) {
          this.operand = new DJS.ArrayLiteralExpression( this );
        }
        else if( token.value == "(" ) {
          this.operand = new DJS.EncapsulatedExpression( this );
        }
        
        this.operand = this.operand.parse( source );
        break;
        
      default:
        throw new DJS.Exception( "Expected an expression...what were you thinking?" );
        break;
    }
    
    return this.setupParent( this.operand );
  },
  toString: function() {
    return this.operand.toString();
  }
});

DJS.RelationalExpression = Class.create( DJS.LeftsideRightsideExpression, {
  initialize: function( $super, parent ) {
    $super( parent );
  },
  parse: function($super, source) {
    this.leftOperand = new DJS.ShiftExpression( this );
    this.leftOperand = this.leftOperand.parse( source );
    
    switch( source.peekToken().value ) {
      case "<":
      case ">":
      case ">=":
      case "<=":
      case "instanceof":    break;
        
      default:        return this.setupParent( this.leftOperand );
    }
    
    this.operator = source.getToken().value; // advance buffer position past ^
    
    this.rightOperand = new DJS.ShiftExpression( this );
    this.rightOperand = this.rightOperand.parse( source );
    
    return this;
  },
  performOp: function( op, ls, rs ) {
    switch( op ) {
      case "<": return ls < rs;
      case ">": return ls > rs;
      case ">=": return ls >= rs;
      case "<=": return ls <= rs;
      case "instanceof": ls instanceof rs;
    }
  },
  toString: function() {
    return this.leftOperand.toString() + ( this.operator ? " " + this.operator + " " + this.rightOperand.toString() : "" );
  }
});

DJS.ShiftExpression = Class.create( DJS.ExpressionOperationList, {
  initialize: function( $super, parent ) {
    $super( parent );
    this.operands = [];
  },
  parse: function($super, source) {
    var operand = new DJS.AdditiveExpression( this );
    operand = operand.parse( source );
    this.operands.push( operand );
    
    while( true ) {
      switch( source.peekToken().value ) {
        case "<<":
        case ">>":
        case ">>>":   
          this.operands.push( source.getToken().value );
          break;
          
        default:    
          return this.setupParent( this.operands.length == 1 ? this.operands[0] : this );
      }
      
      operand = new DJS.AdditiveExpression();
      operand = operand.parse( source );
      this.operands.push( operand );
    }
    
    return this.setupParent( this.operands.length == 1 ? this.operands[0] : this );
  },
  performOp: function( op, ls, rs ) {
    switch( op ) {
      case "<<":  return ls << rs;
      case ">>":  return ls >> rs;
      case ">>>": return ls >>> rs;
    }
  },
  toString: function() {
    return this.operands.join( " " );
  }
});

DJS.UnaryExpression = Class.create( DJS.Expression, {
  initialize: function( $super, parent ) {
    $super( parent );
  },
  parse: function(source) {
    var token = source.peekToken();
    this.startToken = token;
    switch( token.value ) {
      case "++":
      case "--":
      case "+":
      case "-":
      case "~":
      case "!": this.operator = source.getToken().value;
                this.operand = new DJS.UnaryExpression( this );
                this.operand = this.operand.parse( source );
                break;
      case "delete":
      case "typeof":    
                this.operator = source.getToken().value;        
                this.operand = new DJS.PostfixExpression( this );
                this.operand = this.operand.parse( source );
                break;
                
      default:  this.operand = new DJS.PostfixExpression( this );
                this.operand = this.operand.parse( source );
                return this.setupParent( this.operand );
    }
    this.endToken = source.currentToken();
    return this;
  },
  beforeExecute: function( context ) {
    context.addNodeState( this, { step: -1 } );
  },
  step: function( context, op ) {
    var state = context.getNodeState( this );
    var step = state.step;
    
    if( step == -1 ) {
      this.operand.beforeExecute( context );
      step = ++state.step
    }
    
    if( step == 0 ) {
      if( !this.operand.doStep( context, op ) ) {
        return false;
      }
      
      var opState = context.getNodeState( this.operand );
      state.value = opState.value;
      state.container = opState.container;
      state.name = opState.name;
      
      this.operand.afterExecute( context );
      state.step++;
      return false;
    }
    
    if( step == 1 ) {
      switch( this.operator ) {
        case "++":      
          context.setVariable( state.container, state.name, ++state.value );
          break;
          
        case "--":      
          context.setVariable( state.container, state.name, --state.value );
          break;
                  
        case "+": 
          state.value = +state.value;
          break;
          
        case "-": 
          state.value = -state.value;
          break;
          
        case "~": 
          state.value = ~state.value;
          break;
          
        case "!":     
          state.value = !state.value;
          break;
        case "delete":    
          context.deleteVariable( state.container, state.name );
          break;
          
        case "typeof":    
          state.value = typeof state.value;
          break;
      }
      
      return true;
    }
  },
  toString: function() {
    return ( this.operator ? this.operator : "" ) + this.operand.toString();
  }
});

DJS.VariableDeclarationExpression = Class.create( DJS.Expression, {
  initialize: function( $super, parent ) {
    $super( parent );
  },
  parse: function( source ) {
    var token = source.getToken();
    if( token.type != DJS.Token.RESERVED_WORD || token.value != "var" ) {
      throw new DJS.ExceptionNotExpecting( "var", token, source );
    }
    
    token = source.getToken();
    if( token.type != DJS.Token.IDENTIFIER ) {
      throw new DJS.ExceptionNotExpecting( "identifier", token, source );
    }
    
    this.identifier = token.value;
    
    if( source.peekToken().value == ':' ) {
      source.getToken(); // munch up the colon
      ( new DJS.IdentifierExpression() ).parse( source );
    }
    
    token = source.peekToken();
    if( token.type != DJS.Token.OPERATOR || token.value != "=" ) {
      return this;
    }
    
    source.getToken(); // skip equals sign
    
    this.initializer = new DJS.Expression( false );
    this.initializer = this.initializer.parse( source );
    
    return this;
  },
  beforeExecute: function( context ) {
    context.addNodeState( this, { name: this.identifier, value: null, container: context.getLocalScope() } );
    context.setLocalVariable( this.identifier, null );
    if( this.initializer ) this.initializer.beforeExecute( context );
  },
  step: function( context, op ) {
    if( !this.initializer ) return true;
    var done = this.initializer.doStep( context, op );
    if( done ) context.addNodeState( this, 'value', context.getNodeState( this.initializer ).value );
    return done;
  },
  afterExecute: function( $super, context ) {
    var state = context.getNodeState( this );
    context.setLocalVariable( state.name, state.value );
    if( this.initializer ) this.initializer.afterExecute( context );
    $super( context );
  },
  toString: function() {
    return "var " + this.identifier + ( this.initializer ? " = " + this.initializer.toString() : "" );
  },
})