//
// debug.js
//

DJS.StackFrame = Class.create(DJS.Base, {
  initialize: function( thisPath ) {
    this.thisPath = thisPath;
    this.blockStack = [window, document, null, {'window': window, 'document': document}, {}];
    this.setThisObject(this.evalPath(thisPath));
    this.isInLoop = false;
    this.isInSwitch = false;
    
    this.valueChanges = [];
    this.isSuspended = false;
    this.isStepping = false;
    this.stateStore = {};
  },
  
  // setting "this"
  setThisObject: function(thisObj) {
    this.blockStack[2] = thisObj;
    this.blockStack[3]["this"] = thisObj;
  },
  
  // pushing and popping blocks
  push: function(scope) {
    this.blockStack.push( scope ? scope : {} );
  },
  
  pop: function() {
    this.blockStack.pop();
  },
  
  // SETTING AND GETTING VARIABLES
  
  getLocalScope: function() {
    return this.blockStack[this.blockStack.length - 1];
  },
  
  setVariable: function(target, name, value) {
    var old = target[name];
    target[name] = value;
    this.variableChanged(target, name, old, value);
  },
  
  setLocalVariable: function( name, value ) {
    var block = this.blockStack[this.blockStack.length - 1];
    var old = block[name];
    block[name] = value;
    this.variableChanged( block, name, old, value );
  },
  
  deleteVariable: function( target, name ) {
    var old = target[name];
    delete target[name];
    this.variableChanged( target, name, old, undefined );
  },
  
  getVariable: function( name, getContainer ) {
    return this.searchStack( name, getContainer );
  },
  
  // RECORDING VARIABLE CHANGES
  
  variableChanged: function( target, name, oldValue, newValue ) {
    this.valueChanges.push( { target: target, name: name, oldValue: oldValue, newValue: newValue } );
  },
  
  // SETTING THE CURRENTLY EXECUTING NODE
  
  setTargetNode: function( node ) {
    this.targetNode = node;
  },
  
  // STORING STATE FOR NODES
  
  addNodeState: function( node, name, value ) {
    if( !this.stateStore[node.uid()] ) this.stateStore[node.uid()] = {};
    if( typeof( name ) == "object" ) {
      Object.extend( this.stateStore[node.uid()], name );
    } else {
      this.stateStore[node.uid()][name] = value;
    }
  },
  
  removeNodeState: function( node ) {
    delete this.stateStore[node.uid()];
  },
  
  hasNodeState: function( node ) {
    return !!this.stateStore[node.uid()];
  },
  
  getNodeState: function( node ) {
    return this.stateStore[node.uid()];
  },
  
  // EXECUTION COMPLETION
  
  isNodeComplete: function( node ) {
    return this.hasNodeState( node ) && this.getNodeState( node ).__complete__;
  },
  
  markNodeComplete: function( node ) {
    this.addNodeState( node, '__complete__', true );
  },
  
  // SEARCHING THE STACK FOR A VARIABLE
  
  searchStack: function( name, getContainer ) {
    var len = this.blockStack.length;
    for( var i = len - 1; i >= 0; i-- ) 
    {
      var block = this.blockStack[i];
      if( block[name] !== undefined ) {
        return getContainer ? { container: block, name: name, value: block[name] } : block[name];
      }
    }
    
    error( "could not find " + name );
    return null;
  },
  
  // EVALUATING A STRING PATH
  
  evalPath: function( path ) {
    var parts = path.split( '.' );
    var len = parts.length;
    var context = null;
    
    // get initial context
    
    if( parts[0] == "window" ) {
      context = window;
    }
    else if ( parts[0] == "document" ) {
      context = document;
    }
    else {
      throw new DJS.Exception( "evalPath( path ) - this first path part must be window or document" );
    }
    
    for( var i = 1; i < len; i++ ) {
      context = context[ parts[i] ];
    }
    
    return context;
  }
});

// Step operations
DJS.StepOp = {
  OVER: 1,
  IN: 2,
  OUT: 3
};

DJS.BreakPoint = Class.create(DJS.Base, {
  
});

DJS.Watch = Class.create(DJS.Base, {
  initialize: function() {
    
  }
});
