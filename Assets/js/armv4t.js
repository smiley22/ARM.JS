// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
  mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
  define(["../../lib/codemirror"], mod);
  else // Plain browser env
  mod(CodeMirror);
})(function(CodeMirror) {
"use strict";

function getMnemonics() {
  var mnemonics = [
    'ADC', 'ADD', 'AND', 'B',   'BIC', 'BL',  'BX',  'CDP', 'CMN', 'CMP',
    'EOR', 'LDC', 'LDM', 'LDR', 'MCR', 'MLA', 'MOV', 'MRC', 'MRS', 'MSR',
    'MUL', 'MVN', 'ORR', 'RSB', 'RSC', 'SBC', 'STC', 'STM', 'STR', 'SUB',
    'SWI', 'SWP', 'TEQ', 'TST', 'NOP', 'ROR', 'RRX', 'LSL', 'LSR', 'ASR',
    'PUSH', 'POP', 'SMULL', 'SMLAL', 'UMULL', 'UMLAL',
  ];
  var suffixes = {
    'AND':'S', 'EOR':'S', 'SUB':'S', 'RSB':'S',
    'ADD':'S', 'ADC':'S', 'SBC':'S', 'RSC':'S',
    'ORR':'S', 'BIC':'S', 'MUL':'S', 'MLA':'S',
    'MOV':'S', 'MVN':'S',
    'LDR':'BT|B|T|H|SH|SB', 'STR':'BT|B|T|H',
    'LDM':'FD|ED|FA|EA|IA|IB|DA|DB',
    'STM':'FD|ED|FA|EA|IA|IB|DA|DB',
    'SWP':'B', 'LDC':'L', 'STC':'L',
    'UMULL':'S', 'UMLAL':'S', 'SMULL':'S','SMLAL':'S',
    'LSL':'S', 'LSR':'S', 'ASR':'S', 'ROR':'S', 'RRX':'S'
  };
  for (var s in suffixes) {
    var o = suffixes[s].split('|');
    for (var e in o)
      mnemonics.push(s + o[e]);
  }
  return mnemonics;
}

CodeMirror.defineMode('armv4t', function(_config, parserConfig) {
  var mnemonics = getMnemonics();
  var conditions = [
    'EQ', 'NE', 'CS', 'CC', 'MI', 'PL', 'VS', 'VC', 'HI', 'LS', 'GE', 'LT',
    'GT', 'LE', 'AL'
  ];
  var regs = ['sp', 'lr'];
  for (var i = 0; i < 16; i++)
    regs.push('R' + i);
  var keywords1 = new RegExp('^(' + mnemonics.join('|') + ')(' +
                             conditions.join('|') + ')?\\b', 'i');
  var keywords2 = /^(call|j[pr]|ret[in]?|b_?(call|jump))\b/i;
  var variables1 = new RegExp('^(' + regs.join('|') + ')\\b', 'i');
  var variables2 = /^(n?[zc]|p[oe]?|m)\b/i;
  var numbers = /^([\da-f]+h|0x[a-f\d]+|[0-7]+o|[01]+b|\d+d?)\b/i;
//  var numbers = /^(?:0x[a-f\d]+|0b[01]+|(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)(u|ll?|l|f)?/i;

  return {
    startState: function() {
      return {
        context: 0
      };
    },
    token: function(stream, state) {
      if (!stream.column())
        state.context = 0;
      if (stream.eatSpace())
        return null;
      var w;
      if (stream.eatWhile(/\w/)) {
        w = stream.current();
        if (stream.indentation() || true) {
          if ((state.context == 1 || state.context == 4) && variables1.test(w)) {
            state.context = 4;
            return 'variable-2';
          }
          if (state.context == 2 && variables2.test(w)) {
            state.context = 4;
            return 'var3';
          }
          if (keywords1.test(w)) {
            state.context = 1;
            return 'keyword';
          } else if (keywords2.test(w)) {
            state.context = 2;
            return 'keyword';
          } else if (state.context == 4 && numbers.test(w)) {
            return 'number';
          } else if (state.context == 5) {
            state.context = 6;
            return 'equ';
          } else if (state.context == 6) {
            if (numbers.test(w))
              return 'number';
            return 'equ';
          }
        } else if (stream.match(numbers)) {
          return 'number';
        } else {
          return null;
        }
      } 
      else if (stream.eat('#')) {
        if (stream.eatWhile(/[\d+]/))
          return 'number';
      } else if (stream.eat(/;|@/)) {
        stream.skipToEnd();
        return 'comment';
      } else if (stream.eat('"')) {
        while (w = stream.next()) {
          if (w == '"')
            break;
          if (w == '\\')
            stream.next();
        }
        return 'string';
      } else if (stream.eat('\'')) {
        if (stream.match(/\\?.'/))
          return 'number';
      } else if (stream.eat('.')) {
        state.context = 5;
        if (stream.eatWhile(/\w/))
          return 'def';
      } else if (stream.eat('=')) {
        if (stream.eatWhile(/\w/))
          return 'equ';
      } else if (stream.eat('$')) {
        if (stream.eatWhile(/[\da-f]/i))
          return 'number';
      } else if (stream.eat('%')) {
        if (stream.eatWhile(/[01]/))
          return 'number';
      } else {
        stream.next();
      }
      return null;
    }
  };
});

CodeMirror.defineMIME("text/x-armv4t", "armv4t");

});
