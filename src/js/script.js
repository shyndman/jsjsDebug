//
// script.js - Contains script related functions
//

DJS.Statement = Class.create(DJS.Base, {
  
	initialize: function(parent) {
		this.parentStatement = parent;
	},
	
	parse: function(source) {
		var token = source.peekToken()
		
		this.startToken = token;
		switch(token.value) {
		
			case "var":			
			  this.specificStatement = new DJS.VariableDeclarationStatement(this);
				break;
								
			case "{":
			  this.specificStatement = new DJS.BlockStatement(this);
				break;
		
			case "if":		
			  this.specificStatement = new DJS.IfStatement(this);
				break;
		
			case "while":		
			  this.specificStatement = new DJS.WhileStatement(this);
				break;
		
			case "for":			
			  this.specificStatement = new DJS.ForStatement(this);
				break;
		
			case "continue":	
			  this.specificStatement = new DJS.ContinueStatement(this);
				break;
		
			case "break":		
			  this.specificStatement = new DJS.BreakStatement(this);
				break;
		
			case "return":
			  this.specificStatement = new DJS.ReturnStatement(this);
				break;
		
			case "do":			
			  this.specificStatement = new DJS.DoStatement(this);
				break;
		
			case "switch":		
			  this.specificStatement = new DJS.SwitchStatement(this);
				break;
										
			default:
			  this.specificStatement = new DJS.ExpressionStatement(this);
				break;
		}
		
		this.specificStatement.parse(source);
		this.endToken = source.currentToken();
	},
	
	doStep: function(context, op) {
		if(this.step(context, op)) {
			context.markNodeComplete(this);
			return true;
		}
		
		return false;
	},
	
	beforeExecute: function(context) {
		if(this.specificStatement) {
			this.specificStatement.beforeExecute(context);
		}
	},
	
	step: function(context, op) {
		return this.specificStatement.doStep(context, op);
	},
	
	afterExecute: function(context) {
		if(this.specificStatement)
			this.specificStatement.afterExecute(context);
		context.removeNodeState(this);
	},
	
	canStepIn: function(context) {
		return this.specificStatement.canStepIn();
	},
	
	toString: function() {
		if(this.specificStatement == null) {
			return "UNDEFINED STATEMENT";
		}
		
		return this.specificStatement.toString();
	},
	
	toDebugString: function() {
		return this.startToken.toString() + ", " + this.endToken.toString();
	}
});

DJS.StatementList = Class.create(DJS.Statement, {
  
	beforeExecute: function(context) {
		context.addNodeState(this, { idx: -1  });
		context.push();
	},
	
	step: function(context, op) {
		var state = context.getNodeState(this);
		var idx = state.idx;
		var statement;
		
		// node switch
		if(idx == -1 || context.isNodeComplete(this.statementList[idx  ])) {
			if(idx != -1) this.statementList[ idx   ].afterExecute(context);
			context.addNodeState(this, 'idx', ++idx);
			if(idx >= this.statementList.length) return true;
			statement = this.statementList[idx  ];
			statement.beforeExecute(context);
		} else {
			statement = this.statementList[idx  ];
		}
		
		// node execute
		if(!statement.doStep(context, op)) {
			return false;
		}
				
		return false;
	},
	
	afterExecute: function($super, context) {
		$super(context);
		context.pop();
	}
});
DJS.Script = Class.create(DJS.StatementList, {
  
	initialize: function($super, source) {
		$super(null);
		this.source = new DJS.Lexer(source);
	},
	
	parse: function() {
		this.statementList =[  ];
		var token;
		this.startToken = this.source.peekToken();
		while(true) {
			token = this.source.peekToken();
			if(token.type == DJS.Token.EOF) { 
				break;
			}
			
			var statement = new DJS.Statement(this);
			statement.parse(this.source);
			this.statementList.push(statement);
			token = this.source.peekToken();
			
			if(token.value == ";" && token.type == DJS.Token.PUNCTUATOR) {
				this.source.getToken();
			}
		}
		this.endToken = this.source.currentToken();
		
		if(token.value != "") {
			throw new DJS.ExceptionNotExpecting(";", token, this.source);
		}
	},
	
	toString: function() {
		return this.statementList.join("\n");
	}
});

DJS.VariableDeclarationStatement = Class.create(DJS.Statement, {
  
	initialize: function($super, parent) {
		$super(parent);
	},
	
	parse: function(source) {
		var token = source.getToken();
		if(token.type != DJS.Token.RESERVED_WORD || token.value != "var") {
			throw new DJS.ExceptionNotExpecting("var", token, source);
		}
		
		token = source.getToken();
		if(token.type != DJS.Token.IDENTIFIER) {
			throw new DJS.ExceptionNotExpecting("identifier", token, source);
		}
		
		this.identifier = token.value;
		
		if(source.peekToken().value == ':') {
			source.getToken(); // munch up the colon
			(new DJS.IdentifierExpression()).parse(source);
		}
		
		token = source.peekToken();
		if(token.type != DJS.Token.OPERATOR || token.value != "=") {
			return;
		}
		
		source.getToken(); // skip equals sign
		
		this.initializer = new DJS.Expression(this);
		this.initializer = this.initializer.parse(source);
	},
	
	beforeExecute: function(context) {
		context.addNodeState(this, { name: this.identifier, value: null  });
		context.setLocalVariable(this.identifier, null);
		if(this.initializer) this.initializer.beforeExecute(context);
	},
	
	step: function(context, op) {
		if(!this.initializer) return true;
		var done = this.initializer.doStep(context, op);
		if(done) context.addNodeState(this, 'value', context.getNodeState(this.initializer).value);
		return done;
	},
	
	afterExecute: function($super, context) {
		var state = context.getNodeState(this);
		context.setLocalVariable(state.name, state.value);
		if(this.initializer) this.initializer.afterExecute(context);
		$super(context);
	},
	
	toString: function() {
		return "var " + this.identifier +(this.initializer ? " = " + this.initializer.toString() : "") + ";";
	}
});

DJS.BlockStatement = Class.create(DJS.StatementList, {
  
	initialize: function($super, parent) {
		$super(parent);
	},
	
	parse: function(source) {
		this.statementList =[  ];
		var token = source.getToken()
		
		if(token.value != "{") {
			throw new DJS.ExceptionNotExpecting("{", token, source);
		}
		
		do {
			token = source.peekToken();
		
			if(token.value == "}") {
				source.getToken();
				break;
			}

			var statement = new DJS.Statement(this);
			statement.parse(source);
			this.statementList.push(statement);
			
			// gobble up semicolon if possible
			token = source.peekToken();
			if(token.value == ";" && token.type == DJS.Token.PUNCTUATOR) {
				source.getToken();
			}
		} while(true);

		if(token.value != "}") {
			throw new DJS.ExceptionNotExpecting("{", token, source);
		}
	},
	
	toString: function() {
		return "{\n" + this.statementList.join("\n") + "\n}";
	}
});

DJS.IfStatement = Class.create(DJS.Statement, {
  
	initialize: function($super, parent) {
		$super(parent);
		this.expression = new DJS.Expression(this);
		this.thenStatement = new DJS.Statement(this);
	},
	
	parse: function(source) {
		var token = source.getToken()
		
		if(token.type != DJS.Token.RESERVED_WORD || token.value != "if") {
			throw new DJS.ExceptionNotExpecting("if", token, source);
		}
		
		token = source.getToken();

		if(token.type != DJS.Token.PUNCTUATOR || token.value != "(") {
			throw new DJS.ExceptionNotExpecting("(", token, source);
		}
		
		this.expression = this.expression.parse(source);
		token = source.getToken();
		
		if(token.type != DJS.Token.PUNCTUATOR || token.value != ")") {
			throw new DJS.ExceptionNotExpecting(")", token, source);
		}
		
		this.thenStatement.parse(source);
		
		token = source.peekToken();
		
		if(token.type != DJS.Token.RESERVED_WORD || token.value != "else") {
			return;
		}
		
		source.getToken(); // skip past else thenStatement
		
		this.elseStatement = new DJS.Statement(this);
		this.elseStatement.parse(source);
	},
	
	beforeExecute: function(context) {
		context.addNodeState(this, { step: -1  });
	},
	
	step: function(context, op) {
		var state = context.getNodeState(this);
		var step = state.step;
		
		if(step == -1) {
			state.step = ++step;
			this.expression.beforeExecute(context);
		}
		
		if(step == 0) {
			var flag = this.expression.step(context, op);
			if(!flag) {
				return false;
			}
			
			state.condition = context.getNodeState(this.expression).value;
			this.expression.afterExecute(context);
			state.step = ++step;
			var statement = state.condition ? this.thenStatement : this.elseStatement;
			if(!statement) return true;
			statement.beforeExecute(context);
			return false;
		}
		
		if(step == 1) {
			var statement = state.condition ? this.thenStatement : this.elseStatement;
			if(statement.step(context, op)) {
				statement.afterExecute(context);
				return true;
			}
			
			return false;
		}
	},
	
	toString: function() {
		var ret = "if(" + this.expression.toString() + ") " + this.thenStatement.toString();
		if(this.elseStatement) ret += " else " + this.elseStatement.toString();
		return ret;
	}
});

DJS.WhileStatement = Class.create(DJS.Statement, {
  
	initialize: function($super, parent) {
		$super(parent);
		this.expression = new DJS.Expression(this);
		this.statement = new DJS.Statement(this);
	},
	
	parse: function(source) {
		var token = source.getToken()

		if(token.value != "while") {
			throw new DJS.ExceptionNotExpecting("while", token, source);
		}

		token = source.getToken();

		if(token.value != "(") {
			throw new DJS.ExceptionNotExpecting("(", token, source);
		}

		this.expression.parse(source);
		token = source.getToken();

		if(token.value != ")") {
			throw new DJS.ExceptionNotExpecting(")", token, source);
		}

		this.statement.parse(source);
	},
	
	beforeExecute: function(context) {
		context.addNodeState(this, { step: -1, wasInLoop: context.isInLoop  });
		context.isInLoop = true;
	},
	
	step: function(context, op) {
		var state = context.getNodeState(this);
		var step = state.step;
		
		if(step == -1) {
			state.step = ++step;
			this.expression.beforeExecute(context);
		}
		
		if(step == 0) {
			var flag = this.expression.doStep(context, op);
			if(!flag) {
				return false;
			}
			
			state.condition = context.getNodeState(this.expression).value;
			this.expression.afterExecute(context);
			state.step = ++step;
			if(!state.condition) return true;
			this.statement.beforeExecute(context);
			return false;
		}
		
		if(step == 1) {
			var statement = this.statement;
			if(statement.doStep(context, op)) {
				statement.afterExecute(context);
				state.step = -1;
				return false;
			}
			
			return false;
		}
	},
	
	afterExecute: function($super, context) {
		context.isInLoop = context.getNodeState(this).wasInLoop;
		$super(context);
	},
	
	toString: function() {
		return "while(" + this.expression.toString() + ") " + this.statement.toString();
	}
});

DJS.ForStatement = Class.create(DJS.Statement, {
  
	initialize: function($super, parent) {
		$super(parent);
		this.statement = new DJS.Statement(this);
	},
	
	parse: function(source) {
		var token = source.getToken()
		
		if(token.type != DJS.Token.RESERVED_WORD || token.value != "for") {
			throw new DJS.ExceptionNotExpecting("for", token, source);
		}
		
		token = source.getToken();

		if(token.type != DJS.Token.PUNCTUATOR || token.value != "(") {
			throw new DJS.ExceptionNotExpecting("(", token, source);
		}

		this.initializer = new DJS.Expression(this);
		this.initializer = this.initializer.parse(source);
		
		token = source.getToken();
		
		if(token.type == DJS.Token.RESERVED_WORD && token.value == "in") {
			this.parseForIn(source);
		}
		else if(token.value == ";") {
			this.parseStandardFor(source);
		} 
		else {
			throw new DJS.ExceptionNotExpecting("; or in", token, source);
		}
		
		token = source.getToken();
		
		if(token.type != DJS.Token.PUNCTUATOR || token.value != ")") {
			throw new DJS.ExceptionNotExpecting(")", token, source);
		}
		
		this.statement.parse(source);
	},
	
	parseStandardFor: function(source) {
		this.isForIn = false;
		
		this.expression = new DJS.Expression(this);
		this.expression = this.expression.parse(source);
		
		var token = source.getToken();		
		if(token.value != ";") {
			throw new DJS.ExceptionNotExpecting(";", token, source);
		}

		this.updater = new DJS.Expression(this);
		this.updater = this.updater.parse(source); 
	},
	
	parseForIn: function(source) {
		this.isForIn = true;
		
		this.keyExpression = this.initializer;
		this.expression = new DJS.Expression(this);
		this.expression = this.expression.parse(source);
	},
	
	beforeExecute: function(context) {
		context.addNodeState(this, { step: -1, idx: -1, wasInLoop: context.isInLoop  });
		context.isInLoop = true;
	},
	
	step: function(context, op) {
		return this.isForIn ? this.stepForIn(context, op) : this.stepFor(context, op);
	},
	
	stepForIn: function(context, op) {
		var state = context.getNodeState(this);
		var step = state.step;
		
		// prepare expression
		
		if(step == -1) {
			this.expression.beforeExecute(context);
			step = ++state.step;
		}
		
		// pull out all values from expression
		
		if(step == 0) {
			if(!this.expression.doStep(context, op)) {
				return false;
			}
			
			var object = context.getNodeState(this.expression).value;
			state.keys = $H(object).keys();
			this.expression.afterExecute(context);
			step = ++state.step;
			
			this.keyExpression.beforeExecute(context);
			this.keyExpression.doStep(context, op);
			var keyState = context.getNodeState(this.keyExpression);
			state.keyContainer = keyState.container;
			state.keyName = keyState.name;
			this.keyExpression.afterExecute(context);
			
			return false;
		}
		
		// perform the loop once for each key
		
		if(step == 1) {
			state.idx++;
			
			if(state.idx >= state.keys.length) {
				return true;
			}
			
			var k = state.keys[ state.idx   ];
			context.setVariable(state.keyContainer, state.keyName, k);
			
			state.step = 2;
			this.statement.beforeExecute(context);
			return false;
		}
		
		// call the loops statement until finished
		
		if(step == 2) {
			if(this.statement.doStep(context, op)) {
				this.statement.afterExecute(context);
				state.step = 1;
			}
			
			return false;
		}
	},
	
	stepFor: function(context, op) {
		var state = context.getNodeState(this);
		var step = state.step;
		
		// prepare initializer
		
		if(step == -1) {
			this.initializer.beforeExecute(context);
			step = ++state.step;
		}
		
		// run initializer
		
		if(step == 0) {
			if(!this.initializer.doStep(context, op)) {
				return false;
			}
			
			this.initializer.afterExecute(context);
			step = ++state.step;
			this.expression.beforeExecute(context);
			
			return false;
		}
		
		// check expression
		
		if(step == 1) {
			if(!this.expression.doStep(context, op)) {
				return false;
			}
			
			var exprVal = context.getNodeState(this.expression).value;
			this.expression.afterExecute(context);
			
			if(!exprVal) {
				return true;
			}
			
			step = ++state.step;
			this.statement.beforeExecute(context);
			
			return false;
		}
		
		// run statement
		
		if(step == 2) {
			if(!this.statement.doStep(context, op)) {
				return false;
			}
			
			this.statement.afterExecute(context);
			step = ++state.step;
			this.updater.beforeExecute(context);
			
			return false;
		}
		
		// run updater
		
		if(step == 3) {
			if(!this.updater.doStep(context, op)) {
				return false;
			}
			
			this.updater.afterExecute(context);
			state.step = 1;
			this.expression.beforeExecute(context);
			
			return false;
		}
	},
	
	afterExecute: function($super, context) {
		context.isInLoop = context.getNodeState(this).wasInLoop;
		$super(context);
	},
	
	toString: function() {
		var ret = "for("
		if(this.isForIn) {
			ret += this.keyExpression.toString();
			ret += " in ";
			ret += this.expression.toString();
		}
		else {
			if(this.initializer != null) ret += this.initializer.toString();
			ret += "; ";
			if(this.expression != null) ret += this.expression.toString();
			ret += "; ";
			if(this.updater != null) ret += this.updater.toString();
		}
		ret += ")";
		ret += this.statement.toString();
		
		return ret;
	}
});

DJS.ContinueStatement = Class.create(DJS.Statement, {
  
	initialize: function($super, parent) {
		$super(parent);
	},
	
	parse: function(source) {
		var token = source.getToken()

		if(token.type != DJS.Token.RESERVED_WORD || token.value != "continue") {
			throw new DJS.ExceptionNotExpecting("continue", token, source);
		}
	},
	
	step: function(context, op) {
		if(!context.isInLoop) {
			return true;
		}
		
		throw new DJS.ExceptionContinue();
	},
	
	toString: function() {
		return "continue;";
	}
});

DJS.BreakStatement = Class.create(DJS.Statement, {
  
	initialize: function($super, parent) {
		$super(parent);
	},
	
	parse: function(source) {
		var token = source.getToken()
		
		if(token.type != DJS.Token.RESERVED_WORD || token.value != "break") {
			throw new DJS.ExceptionNotExpecting("break", token, source);
		}
	},
	
	step: function(context, op) {
		if(!context.isInSwitch && !context.isInLoop) {
			return true;
		}
		
		throw new DJS.ExceptionBreak();
	},
	
	toString: function() {
		return "break;";
	}
});

DJS.ReturnStatement = Class.create(DJS.Statement, {
  
	initialize: function($super, parent) {
		$super(parent);
	},
	
	parse: function(source) {
		var token = source.getToken()

		if(token.type != DJS.Token.RESERVED_WORD || token.value != "return") {
			throw new DJS.ExceptionNotExpecting("continue", token, source);
		}
		
		token = source.peekToken(0);
		
		if(token.value == ";") {
			return;
		}
		
		this.expression = new DJS.Expression(this);
		this.expression = this.expression.parse(source);
	},
	beforeExecute: function(context) {
		context.addNodeState({ step: -1  });
	},
	step: function(context, op) {
		if(!this.expression) {
			throw new DJS.ExceptionReturn();
		}
		
		var state = context.getNodeState(this);
		var step = state.step;
		
		if(step == -1) {
			this.expression.beforeExecute(context);
			step = ++state.step;
		}
		
		if(step == 0) {
			if(!this.expression.step(context, op)) {
				return false;
			}
			
			var e = new DJS.ExceptionReturn(context.getNodeState(this.expression).value);
			this.expression.afterExecute(context);
			throw e;
		}
	},
	
	toString: function() {
		return "return" +(this.expression ? " " + this.expression.toString() : "") + ";";
	}
});

DJS.DoStatement = Class.create(DJS.Statement, {
  
	initialize: function($super, parent) {
		$super(parent);
		this.statement = new DJS.Statement(this);
		this.expression = new DJS.Expression(this);
	},
	
	parse: function(source) {
		var token = source.getToken()
		
		if(token.type != DJS.Token.RESERVED_WORD || token.value != "do") {
			throw new DJS.ExceptionNotExpecting("do", token, source);
		}

		this.statement.parse(source);
		token = source.getToken();

		if(token.type != DJS.Token.RESERVED_WORD || token.value != "while") {
			throw new DJS.ExceptionNotExpecting("while", token, source);
		}

		token = source.getToken();

		if(token.type != DJS.Token.PUNCTUATOR || token.value != "(") {
			throw new DJS.ExceptionNotExpecting("(", token, source);
		}
		
		this.expression = this.expression.parse(source);
		token = source.getToken();
		
		if(token.type != DJS.Token.PUNCTUATOR || token.value != ")") {
			throw new DJS.ExceptionNotExpecting(")", token, source);
		}
	},
	
	beforeExecute: function(context) {
		context.addNodeState(this, { step: -1, wasInLoop: context.isInLoop  });
		context.isInLoop = true;
	},
	step: function(context, op) {
		var state = context.getNodeState(this);
		var step = state.step;
		
		if(step == -1) {
			state.step = ++step;
			this.statement.beforeExecute(context);
		}
		
		if(step == 0) {
			var flag = this.statement.step(context, op);
			if(!flag) {
				return false;
			}
			
			this.statement.afterExecute(context);
			state.step = ++step;
			this.expression.beforeExecute(context);
			return false;
		}
		
		if(step == 1) {
			if(this.expression.step(context, op)) {
				this.expression.afterExecute(context);
				state.step = -1;
				return getNodeState(this.expression).value;
			}
			
			return false;
		}
	},
	afterExecute: function($super, context) {
		context.isInLoop = context.getNodeState(this).wasInLoop;
		$super(context);
	},
	
	toString: function() {
		return "do " + this.statement.toString() + " while(" + this.expression.toString() + ");"
	}
});

DJS.SwitchStatement = Class.create(DJS.Statement, {
  
	initialize: function($super, parent) {
		$super(parent);
		this.expression = new DJS.Expression(this);
		this.cases =[  ];
		this.defaultCase;
	},
	
	parse: function(source) {
		var token = source.getToken();
		
		if(token.type != DJS.Token.RESERVED_WORD || token.value != "switch") {
			throw new DJS.ExceptionNotExpecting("switch", token, source);
		}

		var token = source.getToken();
				
		if(token.type != DJS.Token.PUNCTUATOR || token.value != "(") {
			throw new DJS.ExceptionNotExpecting("(", token, source);
		}
		
		this.expression = this.expression.parse(source);
		
		var token = source.getToken();
				
		if(token.type != DJS.Token.PUNCTUATOR || token.value != ")") {
			throw new DJS.ExceptionNotExpecting(")", token, source);
		}
		
		var token = source.getToken();
				
		if(token.type != DJS.Token.PUNCTUATOR || token.value != "{") {
			throw new DJS.ExceptionNotExpecting("{", token, source);
		}
		
		while(true) {
		 	token = source.peekToken();
			
			if(token.type == DJS.Token.RESERVED_WORD && token.value == "case") {
				var theCase = new DJS.CaseStatement(this);
				theCase.parse(source);
				this.cases.push(theCase);
			}
			else if(token.type == DJS.Token.RESERVED_WORD && token.value == "default") {
				if(defaultCase != null) {
					throw new DJS.Exception("switch statement cannot contain two default cases");
				}
				
				this.defaultCase = new DJS.CaseStatement(this);
				this.defaultCase.parse(source);
				this.cases.push(defaultCase);
			}
			else if(token.type != DJS.Token.PUNCTUATOR || token.value == "}") {
				break;
			}
			else {
				throw new DJS.ExceptionNotExpecting("case, default or  }", token, source);
			}
		}
		
		token = source.getToken();
		
		if(token.value != "}") {
			throw new DJS.ExceptionNotExpecting("}", token, source);
		}
	},
	
	beforeExecute: function(context) {
		context.addNodeState(this, { step: -1, idx: -1, running: false, wasInSwitch: context.isInSwitch  });
		context.isInSwitch = true;
	},
	
	step: function(context, op) {
		var state = context.getNodeState(this);
		var step = state.step;
		var idx = state.idx;
		
		if(step == -1) {
			this.expression.beforeExecute(context);
			step = ++state.step;
		}
		
		// evaluate expression
		if(step == 0) {
			if(!this.expression.doStep(context, op)) {
				return false;
			}
			
			state.matchValue = context.getNodeState(this.expression).value;
			this.expression.afterExecute(context);
			step = ++state.step;
			return false;
		}
		
		// attempt to match cases
		if(step == 1) {
			var curCase;
			// node switch
			if(idx == -1) {
								
				// get a case with a value
				do {
					idx = ++state.idx;
				
					if(idx >= this.cases.length) {
						// if we haven't run any cases, we go onto the fourth step. the default case
						if(!state.running) {
							state.step = 3;
							return false;
						}
					
						return true;
					}
				
					curCase = this.cases[idx  ];
				} while(!curCase.value);
				
				// prep the value
				
				curCase.value.beforeExecute(context);
			} else {
				curCase = this.cases[idx  ];
			}
			
			// execute the case's value

			if(!curCase.value.doStep(context, op)) {
				return false;
			}
			
			// see if the value matches our match value
			if(context.getNodeState(curCase.value).value == state.matchValue) {
				step = ++state.step;
				state.running = true;
				curCase.beforeExecute(context);
			}
			
			return false;
		}
		
		// run the statements contained within the cases until we hit the end or encounter a break statement
		
		if(step == 2) {
			var curCase = this.cases[idx  ];
			
			// end the case 
			
			if(context.isNodeComplete(curCase)) {
				curCase.afterExecute(context);
				idx = ++state.idx;
				if(idx >= this.cases.length) {
					return true;
				}
				
				curCase = this.cases[idx  ];
				curCase.beforeExecute(context);
			}
			
			// run the case, watching for breaks
			
			try {
				curCase.doStep(context, op);
				return false;
			} catch(e) {
				if(e instanceof DJS.BreakException) {
					curCase.afterExecute(context);
					return true;
				}
			}
		}
		
		// this occurs when no cases were hit, and the switch has a default case
		
		if(step == 3) {
			if(this.defaultCase == null) {
				return true;
			}
			idx = state.idx = this.cases.indexOf(this.defaultCase);
			this.defaultCase.beforeExecute(context);
			step = state.step = 2;
			return false;
		}
	},
	
	afterExecute: function($super, context) {
		context.isInSwitch = context.getNodeState(this).wasInSwitch;
		$super(context);
	},
	
	toString: function() {
		var ret = "switch(" + this.expression.toString() + ") {\n"
			+ this.cases.collect(function(e) { return e.toString();  }).join("\n")
			+ "\n}";
	}
});

DJS.CaseStatement = Class.create(DJS.StatementList, {
  
	initialize: function($super, parent) {
		$super(parent);
		this.value = new DJS.Expression(this);
		this.isDefault = false;
		this.statementList =[  ];
	},
	
	parse: function(source) {
		var token = source.getToken()

		if(token.type != DJS.Token.RESERVED_WORD || token.value == "default") {
			this.isDefault = true;
		}
		else if(token.type != DJS.Token.RESERVED_WORD || token.value == "case") {
			this.isDefault = false;
			this.value = this.value.parse(source);
		}
		else {
			throw new DJS.ExceptionNotExpecting("case or default", token, source);
		}
		
		token = source.getToken();
		
		if(token.type != DJS.Token.OPERATOR || token.value != ":") {
			throw new DJS.ExceptionNotExpecting(":", token, source);
		}
		
		do {
			
			token = source.peekToken();
		
			if(token.value == "case" || token.value == "default" || token.value == "}") {
				break;
			}

			var statement = new DJS.Statement(this);
			statement.parse(source);
			this.statementList.push(statement);
			
			// gobble up semicolon if possible
			token = source.peekToken();
			if(token.value == ";" && token.type == DJS.Token.PUNCTUATOR) {
				source.getToken();
			}
		} while(true);
	},
	toString: function() {
		var ret = "";
		ret = this.isDefault ? "default:\n" : "case " + this.value.toString() + ":\n";
		return ret + this.statementList.collect(function(e) { return e.toString();  }).join("\n");
	}
});

DJS.ExpressionStatement = Class.create(DJS.Statement, {
  
	initialize: function($super, parent) {
		$super(parent);
		this.expression = new DJS.Expression(this);
	},
	
	parse: function(source) {
		this.expression = this.expression.parse(source);
	},
	
	beforeExecute: function(context) {
		context.addNodeState(this, {});
		this.expression.beforeExecute(context);
	},
	
	step: function(context, op) {
		var state = context.getNodeState(this);
		if(this.expression.doStep(context, op)) {
			state.value = context.getNodeState(this.expression).value;
			this.expression.afterExecute(context);
			return true;
		}
		return false;
	},
	
	toString: function() {
		return this.expression.toString() + ";";
	}
});