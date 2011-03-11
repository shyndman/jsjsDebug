//
//  tokens
//

//
// DJS.Token
//
DJS.TokenConstants = {
  // constants
  RESERVED_WORD: 1,
  IDENTIFIER: 2,
  OPERATOR: 3,
  PUNCTUATOR: 4,
  FLOAT_LITERAL: 5,
  INTEGER_LITERAL: 6,
  STRING_LITERAL: 7,
  NULL_LITERAL: 8,
  BOOLEAN_LITERAL: 9,
  UNDEFINED_LITERAL: 10,
  NAN_LITERAL: 11,
  INFINITY_LITERAL: 12,
  EOF: 13,
  UNKNOWN: 14,
  TOKEN_NAMES: [
    "", 
    "RESERVED_WORD", 
    "IDENTIFIER", 
    "OPERATOR", 
    "PUNCTUATOR", 
    "FLOAT_LITERAL", 
    "INTEGER_LITERAL",
    "STRING_LITERAL", 
    "NULL_LITERAL", 
    "BOOLEAN_LITERAL",
    "UNDEFINED_LITERAL",
    "NAN_LITERAL",
    "INFINITY_LITERAL",
    "EOF",
    "UNKNOWN"],
};
DJS.Token = Class.create(DJS.Base, {
    
  // constructs a new token
  initialize: function(type, value, tokenSourceIndex, charStart, lineCharStart, lineNumber) {
    this.type = type;
    this.tokenSourceIndex = tokenSourceIndex;
    this.lineNumber = lineNumber;
    this.charStart = charStart;
    this.lineCharStart = lineCharStart;
    
    var t = DJS.Token;
    switch(type) {
        case t.RESERVED_WORD: 
        case t.IDENTIFIER:
        case t.OPERATOR:
        case t.PUNCTUATOR:
        case t.STRING_LITERAL:    
          this.value = value;
          break;

        case t.FLOAT_LITERAL:   
          this.value = parseFloat(value);
          break;

        case t.INTEGER_LITERAL:   
          this.value = parseInt(value);
          break;

        case t.NULL_LITERAL:    
          this.value = null;
          break;

        case t.BOOLEAN_LITERAL:   
          this.value = (value == "true");
          break;

        case t.UNDEFINED_LITERAL: 
          this.value = undefined;
          break;

        case t.NAN_LITERAL:     
          this.value = NaN;
          break;

        case t.INFINITY_LITERAL:  
          this.value = Infinity;
          break;

        case t.EOF:         
          this.value = "";
          break;

        case t.UNKNOWN:       
          this.value = null;
          break;

        default:          
          throw new { message: "DASToken(): Unknown type '" + type + "'" };
    }
  },
  
  // returns the name of this token's type
  typeName: function() {
    var n = DJS.Token.TOKEN_NAMES[this.type];
    return (n == null) ? "Unknown" : n;
  },
  
  // returns a string representation of the token
  toString: function() {
    return this.value + " (type=" + this.typeName() + ", location=(" + this.charStart + "," + this.lineCharStart + "," + this.lineNumber + "))";
  }
});
Object.extend(DJS.Token, DJS.TokenConstants);

//
// DJS.Lexer - the lexer is responsible for tokenizing a source string
//
DJS.LexerConstants = {
  // constants
  HEX_DIGITS: "0123456789ABCDEFabcdef",
  TYPE_WHITESPACE: "b",
  TYPE_LETTER: "A",
  TYPE_DIGIT: "9",
  TYPE_PUNCTUATION: "P",
  TYPE_UNKNOWN: "U"
};

DJS.Lexer = Class.create(DJS.Base, {
  
  // constructs a new lexer
  initialize: function(source) {
    this.source = source;
    this.tokens = [];
    this.charType = [];
    this.parseCharIndex = 0;
    this.lineCharIndex = 0;
    this.parseTokenIndex = 0;
    this.getTokenIndex = 0;
    this.startOfParse = 0;
    this.lineNumber = 0;
    this.eof = false;
    this.delimiters = "_\"'";
    this.initCharType();
    
    var t = DJS.Token;
    
    this.tokenType = [];
    this.tokenType[" break "]     = t.RESERVED_WORD;
    this.tokenType[" else "]      = t.RESERVED_WORD;
    this.tokenType[" new "]     = t.RESERVED_WORD;
    this.tokenType[" var "]     = t.RESERVED_WORD;
    this.tokenType[" case "]      = t.RESERVED_WORD;
    this.tokenType[" finally "]   = t.RESERVED_WORD;
    this.tokenType[" return "]    = t.RESERVED_WORD;
    this.tokenType[" void "]      = t.RESERVED_WORD;
    this.tokenType[" catch "]     = t.RESERVED_WORD;
    this.tokenType[" for "]     = t.RESERVED_WORD;
    this.tokenType[" switch "]    = t.RESERVED_WORD;
    this.tokenType[" while "]     = t.RESERVED_WORD;
    this.tokenType[" continue "]    = t.RESERVED_WORD;
    this.tokenType[" function "]    = t.RESERVED_WORD;
    this.tokenType[" this "]      = t.RESERVED_WORD;
    this.tokenType[" with "]      = t.RESERVED_WORD;
    this.tokenType[" default "]   = t.RESERVED_WORD;
    this.tokenType[" if "]      = t.RESERVED_WORD;
    this.tokenType[" throw "]     = t.RESERVED_WORD;
    this.tokenType[" delete "]    = t.RESERVED_WORD;
    this.tokenType[" in "]      = t.RESERVED_WORD;
    this.tokenType[" try "]     = t.RESERVED_WORD;
    this.tokenType[" do "]      = t.RESERVED_WORD;
    this.tokenType[" instanceof "]  = t.RESERVED_WORD;
    this.tokenType[" typeof "]    = t.RESERVED_WORD;
    this.tokenType[" abstract "]    = t.RESERVED_WORD;
    this.tokenType[" enum "]      = t.RESERVED_WORD;
    this.tokenType[" int "]     = t.RESERVED_WORD;
    this.tokenType[" short "]     = t.RESERVED_WORD;
    this.tokenType[" boolean "]   = t.RESERVED_WORD;
    this.tokenType[" export "]    = t.RESERVED_WORD;
    this.tokenType[" interface "]   = t.RESERVED_WORD;
    this.tokenType[" static "]    = t.RESERVED_WORD;
    this.tokenType[" byte "]      = t.RESERVED_WORD;
    this.tokenType[" extends "]   = t.RESERVED_WORD;
    this.tokenType[" long "]      = t.RESERVED_WORD;
    this.tokenType[" super "]     = t.RESERVED_WORD;
    this.tokenType[" char "]      = t.RESERVED_WORD;
    this.tokenType[" final "]     = t.RESERVED_WORD;
    this.tokenType[" native "]    = t.RESERVED_WORD;
    this.tokenType[" synchronized "]  = t.RESERVED_WORD;
    this.tokenType[" class "]     = t.RESERVED_WORD;
    this.tokenType[" float "]     = t.RESERVED_WORD;
    this.tokenType[" package "]   = t.RESERVED_WORD;
    this.tokenType[" throws "]    = t.RESERVED_WORD;
    this.tokenType[" const "]     = t.RESERVED_WORD;
    this.tokenType[" goto "]      = t.RESERVED_WORD;
    this.tokenType[" private "]   = t.RESERVED_WORD;
    this.tokenType[" transient "]   = t.RESERVED_WORD;
    this.tokenType[" debugger "]= t.RESERVED_WORD;
    this.tokenType[" implements "]= t.RESERVED_WORD;
    this.tokenType[" protected "] = t.RESERVED_WORD;
    this.tokenType[" volatile "]= t.RESERVED_WORD;
    this.tokenType[" double "]  = t.RESERVED_WORD;
    this.tokenType[" import "]  = t.RESERVED_WORD;
    this.tokenType[" public "]  = t.RESERVED_WORD;
    this.tokenType[" null "]    = t.NULL_LITERAL;
    this.tokenType[" undefined "] = t.UNDEFINED_LITERAL;
    this.tokenType[" true "]    = t.BOOLEAN_LITERAL;
    this.tokenType[" false "]   = t.BOOLEAN_LITERAL;
    this.tokenType[" NaN "]     = t.NAN_LITERAL;
    this.tokenType[" Infinity "]= t.INFINITY_LITERAL;
    this.tokenType[" { "]       = t.PUNCTUATOR;
    this.tokenType[" } "]       = t.PUNCTUATOR;
    this.tokenType[" ("]       = t.PUNCTUATOR;
    this.tokenType[") "]       = t.PUNCTUATOR;
    this.tokenType[" ["]       = t.PUNCTUATOR;
    this.tokenType["] "]       = t.PUNCTUATOR;
    this.tokenType[" ; "]       = t.PUNCTUATOR;
    this.tokenType[" . "]       = t.PUNCTUATOR;
    this.tokenType[" , "]       = t.PUNCTUATOR;
    this.tokenType[" < "]       = t.OPERATOR;
    this.tokenType[" > "]       = t.OPERATOR;
    this.tokenType[" <= "]      = t.OPERATOR;
    this.tokenType[" >= "]      = t.OPERATOR;
    this.tokenType[" == "]      = t.OPERATOR;
    this.tokenType[" != "]      = t.OPERATOR;
    this.tokenType[" === "]     = t.OPERATOR;
    this.tokenType[" !== "]     = t.OPERATOR;
    this.tokenType[" + "]       = t.OPERATOR;
    this.tokenType[" - "]       = t.OPERATOR;
    this.tokenType[" * "]       = t.OPERATOR;
    this.tokenType[" % "]       = t.OPERATOR;
    this.tokenType[" ++ "]      = t.OPERATOR;
    this.tokenType[" + "]       = t.OPERATOR;
    this.tokenType[" -- "]      = t.OPERATOR;
    this.tokenType[" << "]      = t.OPERATOR;
    this.tokenType[" >> "]      = t.OPERATOR;
    this.tokenType[" >>> "]     = t.OPERATOR;
    this.tokenType[" & "]       = t.OPERATOR;
    this.tokenType[" | "]       = t.OPERATOR;
    this.tokenType[" ^ "]       = t.OPERATOR;
    this.tokenType[" ! "]       = t.OPERATOR;
    this.tokenType[" ~ "]       = t.OPERATOR;
    this.tokenType[" && "]      = t.OPERATOR;
    this.tokenType[" || "]      = t.OPERATOR;
    this.tokenType[" ? "]       = t.OPERATOR;
    this.tokenType[" : "]       = t.OPERATOR;
    this.tokenType[" = "]       = t.OPERATOR;
    this.tokenType[" += "]      = t.OPERATOR;
    this.tokenType[" -= "]      = t.OPERATOR;
    this.tokenType[" *= "]      = t.OPERATOR;
    this.tokenType[" %= "]      = t.OPERATOR;
    this.tokenType[" <<= "]     = t.OPERATOR;
    this.tokenType[" >>= "]     = t.OPERATOR;
    this.tokenType[" >>>= "]    = t.OPERATOR;
    this.tokenType[" &= "]      = t.OPERATOR;
    this.tokenType[" |= "]      = t.OPERATOR;
    this.tokenType[" ^= "]      = t.OPERATOR;
    this.tokenType[" / "]       = t.OPERATOR;
    this.tokenType[" /= "]      = t.OPERATOR;
    
    this.stringEscapeMap = [];
    this.stringEscapeMap["'"]     = "'";
    this.stringEscapeMap['"']     = '"';
    this.stringEscapeMap["\\"]    = "\\";
    this.stringEscapeMap["b"]     = "\b";
    this.stringEscapeMap["f"]     = "\f";
    this.stringEscapeMap["n"]     = "\n";
    this.stringEscapeMap["r"]     = "\r";
    this.stringEscapeMap["t"]     = "\t";
    this.stringEscapeMap["v"]     = "\v";
    
    this.digitType = [];
    this.digitType["0"]       = "9";
    this.digitType["1"]       = "9";
    this.digitType["2"]       = "9";
    this.digitType["3"]       = "9";
    this.digitType["4"]       = "9";
    this.digitType["5"]       = "9";
    this.digitType["6"]       = "9";
    this.digitType["7"]       = "9";
    this.digitType["8"]       = "9";
    this.digitType["9"]       = "9";
    this.digitType["A"]       = "F";
    this.digitType["B"]       = "F";
    this.digitType["C"]       = "F";
    this.digitType["D"]       = "F";
    this.digitType["E"]       = "F";
    this.digitType["F"]       = "F";
    this.digitType["a"]       = "F";
    this.digitType["b"]       = "F";
    this.digitType["c"]       = "F";
    this.digitType["d"]       = "F";
    this.digitType["e"]       = "F";
    this.digitType["f"]       = "F";
    this.digitType["."]       = ".";
    this.digitType["+"]       = "+";
    this.digitType["-"]       = "-";
    this.digitType["E"]       = "E";
    this.digitType["e"]       = "E";
    this.digitType["x"]       = "x";
  },
  
  // peeks ahead in the token stream by a certain number of tokens without changing the
  // current token index
  peekToken: function(ahead) {
    if(ahead == null) {
      ahead = 0;
    }
    
    var tokenIndex = ahead + this.getTokenIndex;
    
    while(tokenIndex >= this.parseTokenIndex) {
      this.tokens[this.parseTokenIndex] = this.parseToken();
      this.parseTokenIndex++;
    }
    
    return this.tokens[tokenIndex];
  },
  
  // gets the next token and moves one step forward in the stream
  getToken: function() {
    var token = this.peekToken(0);
    this.getTokenIndex++;
    return token;
  },
  
  currentToken: function() {
    return this.tokens[this.getTokenIndex];
  },
  
  parseToken: function() {
    this.startOfParse = this.parseTokenIndex;
    
    // SKIP WHITESPACE
    
    var c = " ";
    var nc;
    
    while(this.charType[c] == DJS.Lexer.TYPE_WHITESPACE) {
      
      c = this.getChar();
      
      if(c == "") {
        return new DJS.Token(DJS.Token.EOF, "", this.parseCharIndex - 1, this.parseCharIndex, this.lineCharIndex, this.lineNumber);
      }
      else if(c == "\r") {
        c = this.getChar();
        if(c != "\n") this.ungetChar();
        this.lineNumber++;
        this.lineCharIndex = 0;
      }
      else if(c == "\n") {
        this.lineNumber++;
        this.lineCharIndex = 0;
      }
      
      // SCAN PAST COMMENTS
    
      if(c == "/") {
      
        var nc = this.getChar();
      
        if(nc == "*") {
          this.getComment("/*");
          c = this.getChar();
        } else if(nc == "/") {
          this.getComment("//");
          c = this.getChar();
        } else {
          this.ungetChar();
        }
      }
    }
    
    this.startOfParse = this.parseTokenIndex - 1;
    var type = this.charType[c];
    var token;
    
    // CHECK FOR A NUMER THAT STARTS WITH A DECIMAL
    
    if(c == ".") {
      
      nc = this.getChar();
      
      if(this.charType[nc] == DJS.Lexer.TYPE_DIGIT) {
        c += nc;
        type = DJS.Lexer.TYPE_DIGIT;
      } else {
        this.ungetChar();
      }
    }
    
    if(c == "$") {
      type = "_";
    }
    
    switch(type) {
      
      case DJS.Lexer.TYPE_LETTER:
      case "_":           
        token = this.getReservedWordOrIdentifier(c);
        break;
      
      case DJS.Lexer.TYPE_DIGIT:    
        token = this.getNumber(c);
        break;
      
      case "\"":
      case "'":           
        token = this.getString(type);
        break;
                      
      case DJS.Lexer.TYPE_PUNCTUATION:
        token = this.getPunctuationOrOperator(c);
        break;
      
      default:            
        token = new DJS.Token(DJS.Token.UNKNOWN, c, this.startOfParse, this.parseCharIndex - c.length, this.lineCharIndex - c.length, this.lineNumber);
    }
    
    return token;
  },
  
  getChar: function(escapeMap) {
    if(this.parseCharIndex == this.source.length) {
      this.parseCharIndex++;
      this.lineCharIndex++;
      return ""; // EOF
    }
    
    if(this.parseCharIndex > this.source.length) {
      this.trace("THROWING END OF FILE EXCEPTION");
      throw {type: "pastEOF", sender: this};
    }
    
    var c = this.source.charAt(this.parseCharIndex);
    var cls = DJS.Lexer;
    
    if(c == "\\") {
      
      var nc = this.source.charAt(this.parseCharIndex + 1);

      if(nc == "u" &&  cls.HEX_DIGITS.indexOf(this.source.charAt(this.parseCharIndex + 2)) > -1 &&
                cls.HEX_DIGITS.indexOf(this.source.charAt(this.parseCharIndex + 3)) > -1 &&
                cls.HEX_DIGITS.indexOf(this.source.charAt(this.parseCharIndex + 4)) > -1 &&
                cls.HEX_DIGITS.indexOf(this.source.charAt(this.parseCharIndex + 5)) > -1)
      {
        c = String.fromCharCode(parseInt(this.source.substr(this.parseCharIndex + 2, 4)));
        this.source = this.source.substring(0, this.parseCharIndex) + c + this.source.substring(this.parseCharIndex + 6);
        this.parseCharIndex++;
        this.lineCharIndex++;
      } 
      else if(nc == "x" && cls.HEX_DIGITS.indexOf(this.source.charAt(this.parseCharIndex + 2)) > -1 &&
        cls.HEX_DIGITS.indexOf(this.source.charAt(this.parseCharIndex + 3)) > -1)
      {
        c = String.fromCharCode(parseInt(this.source.substr(this.parseCharIndex + 2, 2)));
        this.source = this.source.substring(0, this.parseCharIndex) + c + this.source.substring(this.parseCharIndex + 4);
        this.parseCharIndex++;
        this.lineCharIndex++;
      } else if(escapeMap != null) {
        
        nc = escapeMap[nc];
        
        if(nc != null) {
          this.source = this.source.substring(0, this.parseCharIndex) + nc + this.source.substring(this.parseCharIndex + 2);
        }
      }
    }
      
    this.parseCharIndex++;
    this.lineCharIndex++;
    return c;
  },
  
  ungetChar: function() {
    if(this.parseCharIndex < 1) {
      throw {msg: "ungetChar(): invalid operation."};
    }
    
    this.parseCharIndex--;
    this.lineCharIndex--;
  },
  
  getComment: function(delim) {
    var startOfComment = this.parseTokenIndex - 2;
    
    if(delim == "/*") {
      
      var c1 = this.getChar();
      var c2 = this.getChar();
      
      while(c1 != "*" || c2 != "/") {
        c1 = c2;
        c2 = this.getChar();
      }
      
    } else if(delim == "//") {
      
      var c = this.getChar();
      
      while(c != "\r" && c != "\n") {
        c = this.getChar();
      }
      
    } else {
      throw { msg: "getComment(): invalid delimiter '" + delim + "'" };
    }
    
    return this.source.substring(startOfComment, this.parseTokenIndex);
  },
  
  getReservedWordOrIdentifier: function(token) {
    var c = this.getChar();
    var t = this.charType[c];
    
    while(t == DJS.Lexer.TYPE_LETTER || t == "_" || t == DJS.Lexer.TYPE_DIGIT || t == "$") {
      
      token += c;
      c = this.getChar();
      t = this.charType[c];
    }
    
    this.ungetChar();
    var type = this.tokenType[" " + token + " "];
    
    if(type == null) {
      type = DJS.Token.IDENTIFIER;
    }
    
    return new DJS.Token(type, token, this.startOfParse, this.parseCharIndex - token.length, this.lineCharIndex - token.length, this.lineNumber);
  },
  
  getNumber: function(token) {
    var c = token;
    token = "";
    var type = "9";
    var lastType = " ";
    var pattern = "";
    var hex = false;
    
    while(type != null) {
      
      token += c;
      
      switch(type) {
        
        case "9":   
          if(hex) {
            type = "F";
          }
                
        case "F":   
          if(type != lastType) {
            pattern += type;
          }
          break;
        
        case ".":
        case "+":
        case "-":   
        case "E":   
          pattern += type;
          break;
                
        case "x":   
          hex = true;
          pattern += "x";
          break;
      }
      
      c = this.getChar();
      lastType = type;
      type = this.digitType[c];
    }
    
    this.ungetChar();
    
    switch(pattern) {
      
      case ".9":
      case ".9E9":
      case ".9E+9":
      case ".9E-9":
      case "9.":
      case "9.9":
      case "9.9E9":
      case "9.9E+9":
      case "9.9E-9":
      case "9.E9":
      case "9.E+9":
      case "9.E-9":
      case "9E+9":
      case "9E-9":
      case "9E9":     
        return new DJS.Token(DJS.Token.FLOAT_LITERAL, token, this.startOfParse, this.parseCharIndex - token.length, this.lineCharIndex - token.length, this.lineNumber);
      
      case "9":
        return new DJS.Token(DJS.Token.FLOAT_LITERAL, token, this.startOfParse, this.parseCharIndex - token.length, this.lineCharIndex - token.length, this.lineNumber);
                
      case "9xF":
        if(token.charAt(0) == "0") {
          return new DJS.Token(DJS.Token.INTEGER_LITERAL, token, this.startOfParse, this.parseCharIndex - token.length, this.lineCharIndex - token.length, this.lineNumber);
        }
    }
    
    
    throw { type: "notexpecting", token: new DJS.Token(DJS.Token.UNKNOWN, token, this.startOfParse, this.parseCharIndex - token.length, this.lineCharIndex - token.length, this.lineNumber), sender: this };
  },
  
  getString: function(delim) {
    if(delim != "\"" && delim != "'") {
      throw { msg: "getString(): invalid delimiter: " + delim };
    }     

    var chars = [];
    var c = this.getChar(this.stringEscapeMap);
    
    while(c != delim) {
      chars.push(c);
      c = this.getChar(this.stringEscapeMap);
    }
    
    return new DJS.Token(DJS.Token.STRING_LITERAL, chars.join(""), this.startOfParse, this.parseCharIndex - chars.length, this.lineCharIndex - chars.length, this.lineNumber);
  },
  
  getPunctuationOrOperator: function(token) {
    var c = this.getChar();
    var t = this.charType[c];
    
    while (t == DJS.Lexer.TYPE_PUNCTUATION && this.tokenType[" " + token + c + " "] != null) {
      
      token += c;
      c = this.getChar();
      t = this.charType[c];
    }
    
    this.ungetChar();
    var type = this.tokenType[" " + token + " "];
    
    if(type == null) {
      type = DJS.Token.UNKNOWN;
    }
    
    return new DJS.Token(type, token, this.startOfParse, this.parseCharIndex - token.length, this.lineCharIndex - token.length, this.lineNumber)
  },
  
  getPositionDescription: function(token) {
    return "";
  },
  
  getSource: function(ele) {
    return this.source.substring(ele.startToken.charStart, ele.endToken.charStart + ele.endToken.value.toString().length);
  },
  
  /** Initialize the character types. */
  
  initCharType: function()
  {
    this.generateCharType(DJS.Unicode.WHITESPACE,    DJS.Lexer.TYPE_WHITESPACE);
    this.generateCharType(DJS.Unicode.CAPITAL_LETTERS, DJS.Lexer.TYPE_LETTER);
    this.generateCharType(DJS.Unicode.SMALL_LETTERS, DJS.Lexer.TYPE_LETTER);
    this.generateCharType(DJS.Unicode.DIGITS,      DJS.Lexer.TYPE_DIGIT);
    this.generateCharType(DJS.Unicode.PUNCTUATION,   DJS.Lexer.TYPE_PUNCTUATION);
    
    if(this.delimiters != null) {
      this.generateDelimeterType(this.delimiters);
    }
  },
  
  /** Generate the charType table for a class of characters. */
  
  generateCharType: function(chars, type) {
    chars = chars.split("");
      
    for(var i in chars) {
      this.charType[chars[i]] = type;
    }
  },
  
  /** Update the charType table for delimeters. */
  
  generateDelimeterType: function(chars) {
    chars = chars.split("");
      
    for(var i in chars) {
      
      var d = chars[i];
      this.charType[d] = d;
    }
  }
});
Object.extend(DJS.Lexer, DJS.LexerConstants);

// Unicode Characters
DJS.Unicode = {
  CAPITAL_LETTERS: "\u0041\u00C6\u00C1\u00C2\u00C4\u00C0\u00C5\u00C3\u0042\u0043\u00C7\u0044\u0045\u00D0\u00C9\u00CA\u00CB\u00C8\u0046\u0047\u0048\u0049\u00CD\u00CE\u00CF\u00CC\u004A\u004B\u004C\u004D\u004E\u00D1\u004F\u00D3\u00D4\u00D6\u00D2\u00D8\u00D5\u0050\u0051\u0052\u0053\u0054\u00DE\u0055\u00DA\u00DB\u00DC\u00D9\u0056\u0057\u0058\u0059\u00DD\u005A",
  SMALL_LETTERS: "\u0061\u00E6\u00E1\u00E2\u00E4\u00E0\u00E5\u00E3\u0062\u0063\u00E7\u0064\u0065\u00F0\u00E9\u00EA\u00EB\u00E8\u0066\u0067\u0068\u0069\u00ED\u00EE\u00EF\u00EC\u006A\u006B\u006C\u006D\u006E\u00F1\u006F\u00F3\u00F4\u00F6\u00F2\u00F8\u00F5\u0070\u0071\u0072\u0073\u00DF\u0074\u00FE\u0075\u00FA\u00FB\u00FC\u00F9\u0076\u0077\u0078\u0079\u00FD\u00FF\u007A",
  DIGITS: "\u0030\u0031\u0032\u0033\u0034\u0035\u0036\u0037\u0038\u0039",
  HEX_DIGITS: "\u0030\u0031\u0032\u0033\u0034\u0035\u0036\u0037\u0038\u0039\u0041\u0042\u0043\u0044\u0045\u0046",
  WHITESPACE: "\u0020\u00A0\r\t\n",
  PUNCTUATION: "\u0021\u0022\u0023\u0024\u0025\u0026\u0027\u0028\u0029\u002A\u002B\u002C\u002D\u002E\u002F\u003A\u003B\u003C\u003D\u003E\u003F\u0040\u005B\u005C\u005D\u005E\u005F\u0060\u007B\u007C\u007D\u007E\u00A1\u00A2\u00A3\u00A4\u00A5\u00A6\u00A7\u00A8\u00A9\u00AA\u00AB\u00AC\u00AD\u00AE\u00AF\u00B0\u00B1\u00B2\u00B3\u00B4\u00B5\u00B6\u00B7\u00B8\u00B9\u00BA\u00BB\u00BC\u00BD\u00BE\u00BF\u00D7\u00F7",
  SPACE: "\u0020",
  EXCLAMATION_MARK: "\u0021",
  QUOTATION_MARK: "\u0022",
  NUMBER_SIGN: "\u0023",
  DOLLAR_SIGN: "\u0024",
  PERCENT_SIGN: "\u0025",
  AMPERSAND: "\u0026",
  APOSTROPHE: "\u0027",
  LEFT_PARENTHESIS: "\u0028",
  RIGHT_PARENTHESIS: "\u0029",
  ASTERISK: "\u002A",
  PLUS_SIGN: "\u002B",
  COMMA: "\u002C",
  HYPHEN_MINUS: "\u002D",
  FULL_STOP: "\u002E",
  SOLIDUS: "\u002F",
  COLON: "\u003A",
  SEMICOLON: "\u003B",
  LESS_THAN_SIGN: "\u003C",
  EQUALS_SIGN: "\u003D",
  GREATER_THAN_SIGN: "\u003E",
  QUESTION_MARK: "\u003F",
  COMMERCIAL_AT: "\u0040",
  LEFT_SQUARE_BRACKET: "\u005B",
  REVERSE_SOLIDUS: "\u005C",
  RIGHT_SQUARE_BRACKET: "\u005D",
  CIRCUMFLEX_ACCENT: "\u005E",
  LOW_LINE: "\u005F",
  GRAVE_ACCENT: "\u0060",
  LEFT_CURLY_BRACKET: "\u007B",
  VERTICAL_LINE: "\u007C",
  RIGHT_CURLY_BRACKET: "\u007D",
  TILDE: "\u007E",
  NO_BREAK_SPACE: "\u00A0",
  INVERTED_EXCLAMATION_MARK: "\u00A1",
  CENT_SIGN: "\u00A2",
  POUND_SIGN: "\u00A3",
  CURRENCY_SIGN: "\u00A4",
  YEN_SIGN: "\u00A5",
  BROKEN_BAR: "\u00A6",
  SECTION_SIGN: "\u00A7",
  DIAERESIS: "\u00A8",
  COPYRIGHT_SIGN: "\u00A9",
  FEMININE_ORDINAL_INDICATOR: "\u00AA",
  LEFT_POINTING_DOUBLE_ANGLE_QUOTATION_MARK: "\u00AB",
  NOT_SIGN: "\u00AC",
  SOFT_HYPHEN: "\u00AD",
  REGISTERED_SIGN: "\u00AE",
  MACRON: "\u00AF",
  DEGREE_SIGN: "\u00B0",
  PLUS_MINUS_SIGN: "\u00B1",
  SUPERSCRIPT_TWO: "\u00B2",
  SUPERSCRIPT_THREE: "\u00B3",
  ACUTE_ACCENT: "\u00B4",
  MICRO_SIGN: "\u00B5",
  PILCROW_SIGN: "\u00B6",
  MIDDLE_DOT: "\u00B7",
  CEDILLA: "\u00B8",
  SUPERSCRIPT_ONE: "\u00B9",
  MASCULINE_ORDINAL_INDICATOR: "\u00BA",
  RIGHT_POINTING_DOUBLE_ANGLE_QUOTATION_MARK: "\u00BB",
  VULGAR_FRACTION_ONE_QUARTER: "\u00BC",
  VULGAR_FRACTION_ONE_HALF: "\u00BD",
  VULGAR_FRACTION_THREE_QUARTERS: "\u00BE",
  INVERTED_QUESTION_MARK: "\u00BF",
  MULTIPLICATION_SIGN: "\u00D7",
  DIVISION_SIGN: "\u00F7",
}