/***********************************************************
 *
 * ARMv4T.Assembler.js
 *	Author:	 Torben Könke
 *	Date:    18.05.2012
 *
 * Implements a simple GNU-like ARMv4T Assembler.
 *
 **********************************************************/

var ARMv4T = ARMv4T || {};

ARMv4T.Assembler = {
	Section:	'.TEXT',
	Pass:		0,	

	/*
	 * ARMv4T.Assembler.Parse
	 *	Parses ARM assembly code.
	 *
	 * @S:
	 *	Textbuffer to be parsed.
	 *
	 * @Return
	 *	Returns an array of assembled 'machine instructions'.
	 *	If an error occurs, an exception is thrown.
	 */
	Parse: function(S) {
		S = ARMv4T.Assembler.StripComments(S);
		/* Clean up and trim all lines */
		var A = S.split('\n');
		var E = [];
		for(var i in A) {
			A[i] = A[i].replace(/\t/g, ' ').trim();
			if(A[i] != '')
				E.push(A[i]);
		}

		ARMv4T.Assembler.Pass = 0;
		E = ARMv4T.Assembler.Pass0(E);
			ARMv4T.Assembler.Pass1(E);

		return {
			Sections: ARMv4T.Assembler.Sections,
			Symbols: ARMv4T.Assembler.Symbols
		};
	},

	/*
	 * ARMv4T.Assembler.Pass0
	 *	Collects all labels and removes label definitions. On
	 *	completion of Pass 0 the symbol table will have been fully
	 *	constructed.
	 *
	 * @E:
	 *	Array of source lines (directives, instructions, labels)
	 *
	 * @Return
	 *	 An Array of ARM assembly source code lines, containing
	 *	 only directives and instructions.
	 */
	Pass0: function(E) {
		/* Clean up from possible previous invocations */
		ARMv4T.Assembler.Symbols.Clear();
		ARMv4T.Assembler.Sections.Clear();

		for(var i = 0; i < E.length; i++) {
			var S = E[i].trim();
			if(S.match(/^(.*):(.*)$/)) {
				var SegPtr = ARMv4T.Assembler.Sections
					[ARMv4T.Assembler.Section].Size;
				ARMv4T.Assembler.Symbols.Add({
					'Name':		RegExp.$1,
					'Type':		'Label',
					'Value':	SegPtr,
					'Section':	ARMv4T.Assembler.Section
				});
				// Remove label from line and fall through
				S = E[i] = RegExp.$2.trim();
				if(S == '')
					continue;
			}

			/* Assembler directive */
			if(S.match(/^\.(\w+)\s*(.*)/)) {
				if(ARMv4T.Assembler.ParseDirective0(RegExp.$1, RegExp.$2)) {
					/* Remove directive */
					E[i] = '';
				}
			}
			else {
				/* Assume instruction. All instructions are 32-bit */
				ARMv4T.Assembler.Sections[ARMv4T.Assembler.Section].Size += 4;
			}
		}
		/* Create a literal pool in .text section after instructions */
		ARMv4T.Assembler.Litpools.Create(ARMv4T.Assembler.Sections['.TEXT'].Size);

		var O = [];
		for(var i in E) {
			if(E[i] != '')
				O.push(E[i]);
		}
		return O;
	},

	/*
	 * ARMv4T.Assembler.Pass1
	 *	Assembles the actual instructions and processes directives
	 *	which have not been processed during pass 0.
	 *
	 * @E:
	 *	Array of source lines (directives, instructions)
	 *
	 * @Return
	 *		?
	 */
	Pass1: function(E) {
		ARMv4T.Assembler.Pass = 1;

		for(var i = 0; i < E.length; i++) {
			/* Assembler directive */
			if(E[i].match(/^\.(\w+)\s*(.*)/)) {
				ARMv4T.Assembler.ParseDirective1(RegExp.$1, RegExp.$2);
			}
			else {
				/* assemble instruction and write instruction word to section */
				var iw = ARMv4T.Assembler.Assemble(E[i]);
				ARMv4T.Assembler.Sections.Write(iw, 'WORD');
			}
		}
	},

	/*
	 * ARMv4T.Assembler.StripComments
	 *	Strips all comments from the source file. Based on code
	 *	written by James Padolsey.
	 *
	 *	The following comment notations are supported:
	 *		Single line:
	 *			# This is a comment (only at start of line)
	 *			; This is a comment
	 *			@ This is a comment
	 *		Block:
	 *			C99/C++/JS Block-style comments
	 *	@S
	 *	 Textbuffer to be processed.
	 *
	 *	@Return
	 *	 Returns a string stripped of all comments.
	 */
	StripComments: function(S) {
		var str = ('__' + S + '__').split('');
		var mode = {
			singleQuote:	false,	doubleQuote: false,
			blockComment:	false,	lineComment: false
		};
		for(var i = 0, l = str.length; i < l; i++) {
			if(mode.singleQuote) {
				if(str[i] === "'" && str[i-1] !== '\\')
					mode.singleQuote = false;
				continue;
			}
			if(mode.doubleQuote) {
				if(str[i] === '"' && str[i-1] !== '\\')
					mode.doubleQuote = false;
				continue;
			}
			if(mode.blockComment) {
				if(str[i] === '*' && str[i+1] === '/') {
					str[i+1] = '';
					mode.blockComment = false;
				}
				str[i] = '';
				continue;
			}
			if(mode.lineComment) {
				if(str[i+1] === '\n' || str[i+1] === '\r')
					mode.lineComment = false;
				else if(str[i] === '\n' || str[i] === '\r')
					mode.lineComment = false;

				str[i] = '';
				continue;
			}
			mode.doubleQuote = str[i] === '"';
			mode.singleQuote = str[i] === "'";
			
			if (str[i] === '/') { 
				if (str[i+1] === '*') {
					str[i] = '';
					mode.blockComment = true;
					continue;
				}
			}
			else if(str[i] === '@' || str[i] === ';') {
				str[i] = '';
				mode.lineComment = true;
				continue;
			}
			else if(str[i] === '#') {
				var empty = true;
				for(var c = i - 1; c >= 2 /* account for first 2 __  characters */; c--) {
					if(str[c] == '\n')
						break;
					if(str[c] != '' && str[c] != ' ' && str[c] != '\t') {
						empty = false;
						break;
					}
				}
				if(empty) {
					str[i] = '';
					mode.lineComment = true;
					continue;
				}
			}
		}
		return str.join('').slice(2, -2);
	},

	/*
	 * ARMv4T.Assembler.Assemble
	 *	Assembles a line of ARM assembly code.
	 *
	 * @S:
	 *	instruction to be assembled.
	 *
	 * @Return
	 *	Returns the assembled machine instruction as a 32-bit word.
	 *	If an error occurs, an exception is thrown.
	 */
	Assemble: function(S) {
		/* Parse mnemonic, conditions, possible suffixes and operands */
		var Info = ARMv4T.Assembler.ParseMnemonic(S);
		var Ret  = ARMv4T.Assembler.ParseOperands(Info[0]['Mnemonic'], Info[1]);

		/* merge collected data into one object */
		var O = ARMv4T.Assembler.MergeObjects(Info[0], Ret);

		return ARMv4T.Assembler.BuildInstruction(O);
	},

	/*
	 * ARMv4T.Assembler.Mnemonics
	 *	Operation codes implemented by the ARMv4T Architecture.
	 *
	 *	See ARM7TDMI-S Data Sheet, Chapter 4 (ARM Instruction Set)
	 */
	Mnemonics: [
		'ADC', 'ADD', 'AND', 'B',   'BIC', 'BL',  'BX',  'CDP', 'CMN', 'CMP',
		'EOR', 'LDC', 'LDM', 'LDR', 'MCR', 'MLA', 'MOV', 'MRC', 'MRS', 'MSR',
		'MUL', 'MVN', 'ORR', 'RSB', 'RSC', 'SBC', 'STC', 'STM', 'STR', 'SUB',
		'SWI', 'SWP', 'TEQ', 'TST', 'NOP', 'PUSH', 'POP', 'UMULL', 'UMLAL',
		'SMULL', 'SMLAL', 'LSL', 'LSR', 'ASR', 'ROR', 'RRX'
	],

	/*
	 * ARMv4T.Assembler.ParseMnemonic
	 *	Parses Mnemonic and condition field
	 *
	 *	@S
	 *	 Instruction string to be parsed
	 *
	 *	@Return
	 *	 Returns an array composed of an object containing the parsed fields at
	 *	 index 0 and the remainder of the instruction string at index 1.
	 */
	ParseMnemonic: function(S) {
		var Ret = {};
		var Matched = false;
		S = S.replace(/\t/g,' ').trim();
		var T = S.split(' ');
		for(i = 0; i < T[0].length; i++, Ret = {}) {
			var C = T[0].substr(0, i + 1).toUpperCase();
			if(ARMv4T.Assembler.Mnemonics.indexOf(C) < 0)
				continue;
			Ret['Mnemonic'] = C;
			var D = T[0].substr(i + 1);
			var Cond = D.substr(0, 2).toUpperCase();
			if(ARMv4T.Assembler.Conditions.indexOf(Cond) >= 0) {
				Ret['Condition'] = Cond;
				D = D.substr(Cond.length);
			}
			if(D == '') {
				Matched = true;
				break;
			}
			var SL = ARMv4T.Assembler.Suffixes[C];
			if(!SL)
				continue;
			for(var c = 0; c < SL.length; c++) {
				var RE = new RegExp('^(' + SL[c].Suffix + ')' +
					(SL[c].Required ? '' : '?'), 'i');
				if(!RE.exec(D) || RegExp.$1 == '')
					continue;
				Ret[SL[c].Name ? SL[c].Name : SL[c].Suffix] = RegExp.$1.toUpperCase();
				D = D.substr(RegExp.$1.length);
			}
			if(D == '') {
				Matched = true;
				break;
			}
		}
		if(!Matched)
			throw new SyntaxError('Invalid mnemonic ' + S);
		return [Ret, S.substr(S.indexOf(' ')).trim()];
	},

	/*
	 * ARMv4T.Assembler.Conditions
	 *	Condition codes supported by the ARMv4T Architecture.
	 *
	 *	See ARM7TDMI-S Data Sheet, 4.2 Condition Fields
	 */
	Conditions: [
		'EQ', 'NE', 'CS', 'CC', 'MI', 'PL', 'VS', 'VC', 'HI', 'LS', 'GE', 'LT',
		'GT', 'LE', 'AL'
	],

	/*
	 * ARMv4T.Assembler.ConditionMask
	 *	Returns the bitmask used in instruction words to encode the
	 *	condition codes supported by the ARMv4T Architecture.
	 *
	 *	See ARM7TDMI-S Data Sheet, 4.2 Condition Fields
	 *
	 * @C
	 *	Condition code to lookup.
	 *
	 * @Return
	 *	Returns the bitmask used to encode the condition.
	 */
	ConditionMask: function(C) {
		var M = {
			'EQ': 0x00, 'NE': 0x01, 'CS': 0x02, 'CC': 0x03, 'MI': 0x04,
			'PL': 0x05, 'VS': 0x06, 'VC': 0x07, 'HI': 0x08, 'LS': 0x09,
			'GE': 0x0A, 'LT': 0x0B, 'GT': 0x0C, 'LE': 0x0D, 'AL': 0x0E
		};
		/* default: always execute */
		if(!C)
			return M['AL'];
		if(typeof(M[C]) == 'undefined')
			throw new Error('Invalid condition code: ' + C);
		return M[C];
	},

	/*
	 * ARMv4T.Assembler.Suffixes
	 *	List of suffixes each mnemonic can, or must have. Mnemonics not listed,
	 *	don't have any suffixes.
	 *
	 *	See ARM7TDMI-S Data Sheet, Chapter 4.0
	 */
	Suffixes: {
		'AND':[{Suffix:'S'}], 'EOR':[{Suffix:'S'}], 'SUB':[{Suffix:'S'}], 'RSB':[{Suffix:'S'}],		
		'ADD':[{Suffix:'S'}], 'ADC':[{Suffix:'S'}], 'SBC':[{Suffix:'S'}], 'RSC':[{Suffix:'S'}],
		'ORR':[{Suffix:'S'}], 'BIC':[{Suffix:'S'}], 'MUL':[{Suffix:'S'}], 'MLA':[{Suffix:'S'}],
		'MOV':[{Suffix:'S'}], 'MVN':[{Suffix:'S'}],
		'LDR':[{Suffix:'BT|B|T|H|SH|SB', Name:'Mode'}],
		'STR':[{Suffix:'BT|B|T|H', Name:'Mode'}],
		'LDM':[{Suffix:'FD|ED|FA|EA|IA|IB|DA|DB', Required:true, Name:'Mode'}],
		'STM':[{Suffix:'FD|ED|FA|EA|IA|IB|DA|DB', Required:true, Name:'Mode'}],
		'SWP':[{Suffix:'B'}], 'LDC':[{Suffix:'L'}], 'STC':[{Suffix:'L'}],
		'UMULL':[{Suffix:'S'}], 'UMLAL':[{Suffix:'S'}], 'SMULL':[{Suffix:'S'}],
		'SMLAL':[{Suffix:'S'}],
		'LSL':[{Suffix:'S'}], 'LSR':[{Suffix:'S'}], 'ASR':[{Suffix:'S'}], 'ROR':[{Suffix:'S'}],
		'RRX':[{Suffix:'S'}]
	},

	/*
	 * ARMv4T.Assembler.MergeObjects
	 *	Helper function to merge properties of two objects into one
	 *
	 *	@A
	 *	 First object whose properties will be merged.
	 *
	 *	@B
	 *	 Second object whose properties will be merged.
	 *
	 *	@Return
	 *	 Returns a new object composed of properties of A and B
	 */
	MergeObjects: function(A, B) {
		var Ret = {};
		for(var i in A)
			Ret[i] = A[i];
		for(var i in B)
			Ret[i] = B[i];
		return Ret;
	},

	/*
	 * ARMv4T.Assembler.ParseRegister
	 *	Attempts to parse a valid ARM register identifier from
	 *	a string. Throws an exception if unsuccessful.
	 *
	 *	@S
	 *	 String to be parsed.
	 *
	 *	@Return
	 *	 Returns the parsed ARM register identifier
	 */
	ParseRegister: function(S) {
		var N = {'FP':'R11', 'SP':'R13', 'LR':'R14', 'PC':'R15'};
		S = S.trim().toUpperCase();
		if(S.length == 2) {
			if(S[0] == 'R' && !isNaN(parseInt(S[1])))
				return S;
			if(N[S])
				return N[S];
		} else if(S.length == 3) {
			if(S[0] == 'R' && S[1] == '1' && parseInt(S[2]) < 6)
				return S;
		}
		throw new SyntaxError('Expected ARM register identifier');
	},

	/*
	 * ARMv4T.Assembler.ParseCPRegister
	 *	Attempts to parse a valid co-processor register identifier
	 *	from a string. Throws an exception if unsuccessful.
	 *
	 *	@S
	 *	 String to be parsed.
	 *
	 *	@Return
	 *	 Returns the parsed co-processor register identifier
	 */
	ParseCPRegister: function(S) {
		S = S.trim().toUpperCase();
		if(S.length == 2) {
			if(S[0] == 'C' && !isNaN(parseInt(S[1])))
				return S;
		} else if(S.length == 3) {
			if(S[0] == 'C' && S[1] == '1' && parseInt(S[2]) < 6)
				return S;
		}
		throw new SyntaxError('Expected co-processor register identifier');
	},

	/*
	 * ARMv4T.Assembler.ParseExpression
	 *	Attempts to parse an expression from a string. Throws
	 *	an exception if unsuccessful.
	 *
	 *	@S
	 *	 String to be parsed.
	 *
	 *	@Return
	 *	 Returns the parsed ARM register identifier
	 */
	ParseExpression: function(E) {
		if(E[0] == '#')
			E = E.substr(1);
		try {
			var T = parseInt(eval(E));
			if(!isNaN(T))
				return T;
		} catch(e) {
			var M = E.match(/[A-Za-z_]\w+/g);
			for(var i in M)
				E = E.replace(new RegExp(M[i], 'g'), ARMv4T.Assembler.Symbols.Get(M[i]));
			try {
				var T = parseInt(eval(E));
				if(isNaN(T))
					throw new Error('Invalid expression');
				return T;
			} catch(e) {
				throw new Error('Unresolved symbol ' + E);
			}
		}
	},	
	
	/*
	 * ARMv4T.Assembler.IsRegister
	 *	Returns true if passed operand is a register identifier
	 *
	 * @R
	 *	Operand to be tested.
	 *
	 * @Return
	 *	Returns true if R is an ARM register identifier, otherwise
	 *	false.
	 */
	IsRegister: function(R) {
		if(typeof(R) != 'string' || R.length < 2)
			return false;
		return R[0] == 'R';
	},

	/*
	 * ARMv4T.Assembler.ParseOperands
	 *	Holds information on instructions used by the assembler to
	 *	validate the syntax of an instruction and parse its'
	 *	operands.
	 *
	 *	@Mnemonic
	 *	 Mnemonic of the instruction whose operands will
	 *	 be parsed.
	 *
	 *	@S
	 *	 String containing the operands of Mnemonic
	 *
	 *	@Return
	 *	 Returns an object containing the parsed operands.
	 */
	ParseOperands: function(Mnemonic, S) {
		var Lookup = [
			[ ['BX'],										0  ],
			[ ['BL', 'B', 'SWI'],							1  ],
			[ ['AND', 'EOR', 'SUB', 'RSB', 'ADD', 'ADC',
				'SBC', 'RSC', 'ORR', 'BIC'],				2  ],
			[ ['MRS'],										3  ],
			[ ['MSR'],										4  ],
			[ ['MUL'],										5  ],
			[ ['MLA'],										6  ],
			[ ['UMULL', 'UMLAL', 'SMULL', 'SMLAL'],			7  ],
			[ ['LDR', 'STR'],								8  ],
			[ ['LDM', 'STM'],								9  ],
			[ ['SWP'],										10 ],
			[ ['CDP'],										11 ],
			[ ['LDC', 'STC'],								12 ],
			[ ['MCR', 'MRC'],								13 ],
			[ ['MOV', 'MVN'],	14 ],
			[ ['NOP'],										15 ],
			[ ['PUSH', 'POP'],								16 ],
			[ ['LSL', 'LSR', 'ASR', 'ROR'],					17 ],
			[ ['RRX'],										18 ],
      [ ['CMP', 'CMN', 'TEQ', 'TST'], 19]
		];

		for(var i in Lookup) {
			if(Lookup[i][0].indexOf(Mnemonic.toUpperCase()) >= 0)
				return ARMv4T.Assembler['ParseOperands_' +
					Lookup[i][1]](S);
		}
		throw new SyntaxError('Invalid Mnemonic ' + Mnemonic);
	 },

	/*
	 * ARMv4T.Assembler.BuildInstruction
	 *	Assembles the actual 32-bit instruction word.
	 *
	 * @O
	 *	Object containing the mnemonic and operands as well
	 *	as possible operation flags if applicable.
	 *
	 * @Return
	 *	Returns a 32-bit ARM instruction word. Throws an
	 *	exception in case of error.
	 */
	BuildInstruction: function(O) {
		var Lookup = [
			[ ['BX'],										0  ],
			[ ['B', 'BL'],									1  ],
			[ ['AND', 'EOR', 'SUB', 'RSB', 'ADD', 'ADC',
				'SBC', 'RSC', 'ORR', 'BIC', 'MOV', 'MVN'], 2  ],
			[ ['MRS'],										3  ],
			[ ['MSR'],										4  ],
			[ ['MUL', 'MLA'],								5  ],
			[ ['UMULL', 'UMLAL', 'SMULL', 'SMLAL'],			6  ],
			[ ['LDR', 'STR'],								7  ],
			/* */
			[ ['LDM', 'STM'],								9  ],
			[ ['SWP'],										10 ],
			[ ['SWI'],										11 ],
			[ ['CDP'],										12 ],
			[ ['LDC', 'STC'],								13 ],
			[ ['MRC', 'MCR'],								14 ],
			[ ['PUSH', 'POP'],								15 ],
			[ ['LSL', 'LSR', 'ASR', 'ROR'],					16 ],
			[ ['RRX'],										17 ],
			[ ['NOP'],										18 ],
      [ ['CMP', 'CMN', 'TEQ', 'TST'], 19]
		];
		for(var i in Lookup) {
			if(Lookup[i][0].indexOf(O['Mnemonic']) >= 0)
				return ARMv4T.Assembler['BuildInstruction_' +
					Lookup[i][1]](O);
		}
		throw new SyntaxError('Invalid Mnemonic ' + O['Mnemonic']);
	},

	/*
	 * ARMv4T.Assembler.ParseOperands_0
	 *	Parses operands for instructions of assembler syntax:
	 *		<BX>{cond} Rn
	 *
	 *	@S
	 *	 String containing operands.
	 *
	 *	@Return
	 *	 An Object representing the parsed operands.
	 */
	ParseOperands_0: function(S) {
		return { 'Rn': ARMv4T.Assembler.ParseRegister(S) };
	},

	/*
	 * ARMv4T.Assembler.ParseOperands_1
	 *	Parses operands for instructions of assembler syntax:
	 *		<B|BL>{cond} <expression>
	 *
	 *	@S
	 *	 String containing operands.
	 *
	 *	@Return
	 *	 An Object representing the parsed operands.
	 */
	ParseOperands_1: function(S) {
		var T = ARMv4T.Assembler.ParseExpression(S);
		if(T % 4)
			throw new SyntaxError('Misaligned branch destination');
		/* offset is 24 bits signed field which is shifted left 2 bits
			to allow for a +/-32Mbytes PC-relative jump */
		if(T < -33554432 || T > 33554431)
			throw new RangeError('branch destination is out of range');
		return { 'Offset': T };
	},

	/*
	 * ARMv4T.Assembler.ParseOperands_2
	 *	Parses operands for instructions of assembler syntax:
	 *		<ADD|AND|Etc.>{cond}{S} Rd,Rn,<Op2>
	 *
	 *	@S
	 *	 String containing the operands.
	 *
	 *	@Return:
	 *	 Returns an object representing the parsed operands.
	 */
	ParseOperands_2: function(S) {
		var R = {};
		var A = S.split(',');
		for(var i in A)
			A[i] = A[i].trim();
		if(A.length == 1)
			throw new SyntaxError('Invalid instruction syntax');		
		R['Rd'] = ARMv4T.Assembler.ParseRegister(A[0]);
		var IsImm = false;
		try {
			R['Rn'] = ARMv4T.Assembler.ParseRegister(A[1]);
		} catch(e) {
			R['Rn'] = ARMv4T.Assembler.ParseExpression(A[1]);
			IsImm = true;
		}
		if(IsImm && A.length > 2)
			throw new SyntaxError('Invalid instruction syntax');
		if(A.length == 2) {
			if(IsImm) {
				R['Op2'] = ARMv4T.Assembler.EncodeImmediate(R['Rn']);
				R['Immediate'] = true;
			}
			else
				R['Op2'] = R['Rn'];
			R['Rn']  = R['Rd'];
			return R;
		}
		try {
			R['Op2'] = ARMv4T.Assembler.ParseRegister(A[2]);
		} catch(e) {
			var T	= ARMv4T.Assembler.ParseExpression(A[2]);
			var Enc = ARMv4T.Assembler.EncodeImmediate(T);

			R['Immediate'] = true;
			R['Op2'] = Enc;
		}
		if(A.length == 3)
			return R;
		if(R['Immediate']) {
			if(R['Op2'].Rotate > 0)
				throw new Error('Illegal shift on rotated value');
			var T = ARMv4T.Assembler.ParseExpression(A[3]);
			if((T % 2) || T < 0 || T > 30)
				throw new Error('Invalid rotation: ' + T);
			R['Op2'].Rotate = T / 2;
		} else {
			if(A[3].match(/^(ASL|LSL|LSR|ASR|ROR)\s*(.*)$/i)) {
				R['ShiftOp'] = RegExp.$1;

				var F = RegExp.$2;
				try {
					R['Shift'] = ARMv4T.Assembler.ParseRegister(F);
				} catch(e) {
					var T = ARMv4T.Assembler.ParseExpression(F);
					if(T > 31)
						throw new RangeError('Shift value out of range');
					R['Shift'] = T;
				}
			}
			else if(A[3].match(/^RRX$/i))
				R['Rrx'] = true;
			else
				throw new SyntaxError('Invalid expression');
		}
		if(A.length > 4)
			throw new SyntaxError('Invalid instruction syntax');
		return R;
	},

	/*
	 * ARMv4T.Assembler.ParseOperands_3
	 *	Parses operands for MRS instruction.
	 *
	 *	@S
	 *	 String containing operands.
	 *
	 *	@Return
	 *	 An Object representing the parsed operands.
	 */
	ParseOperands_3: function(S) {
		var R = {};
		var A = S.split(',');
		for(var i in A)
			A[i] = A[i].trim();
		if(A.length == 1)
			throw new SyntaxError('Invalid instruction syntax');
		R['Rd'] = ARMv4T.Assembler.ParseRegister(A[0]);
		if(R['Rd'] == 'R15')
			throw new Error('R15 is not allowed as destination register');
		if(!A[1].match(/^(CPSR|CPSR_all|SPSR|SPSR_all)$/i))
			throw new SyntaxError('Constant identifier expected');
		R['P'] = RegExp.$1.toUpperCase();
		return R;
	},

	/*
	 * ARMv4T.Assembler.ParseOperands_4
	 *	Parses operands for MSR instruction.
	 *
	 *	@S
	 *	 String containing operands.
	 *
	 *	@Return
	 *	 An Object representing the parsed operands.
	 */
	ParseOperands_4: function(S) {
		var R = {};
		var A = S.split(',');
		for(var i in A)
			A[i] = A[i].trim();
		if(A.length == 1)
			throw new SyntaxError('Invalid instruction syntax');
		if(!A[0].match(/^(CPSR|CPSR_all|SPSR|SPSR_all|CPSR_flg|SPSR_flg)$/i))
			throw new SyntaxError('Constant identifier expected');
		R['P'] = RegExp.$1.toUpperCase();
		var Imm = R['P'].match(/_flg/i) != null;
		try {
			R['Op2'] = ARMv4T.Assembler.ParseRegister(A[1]);
			if(R['Op2'] == 'R15')
				throw new Error('R15 is not allowed as source register');
		} catch(e) {
			if(!Imm)
				throw e;
			var T = ARMv4T.Assembler.ParseExpression(A[1]);
			var L = 0;
			for(var i = 31; i >= 0; i--) {
				if(!L && ((T >>> i) & 0x1 ))
					L = i;
				if((L - i) > 8 && ((T >>> i) & 0x1 ))
					throw new Error('invalid constant (' + T.toString(16) + ') after fixup');
			}
			R['Op2'] = ARMv4T.Assembler.ParseExpression(A[1]);
		}
		return R;
	},

	/*
	 * ARMv4T.Assembler.ParseOperands_5
	 *	Parses operands for instructions of assembler syntax:
	 *		<MUL>{cond}{S} Rd,Rm,Rs
	 *
	 *	@S
	 *	 String containing operands.
	 *
	 *	@Return
	 *	 An Object representing the parsed operands.
	 */
	ParseOperands_5: function(S) {
		var R = {};
		var A = S.split(',');
		for(var i in A)
			A[i] = A[i].trim();
		if(A.length != 3)
			throw new SyntaxError('invalid instruction syntax');
		for(var i = 1; i < 4; i++) {
			R['Op' + i] = ARMv4T.Assembler.ParseRegister(A[i - 1]);
			if(R['Op' + i] == 'R15')
				throw new Error('R15 must not be used as operand');
		}
		if(R['Op1'] == R['Op2'])
			throw new Error('destination register must not be the same as operand');
		return R;
	},

	/*
	 * ARMv4T.Assembler.ParseOperands_6
	 *	Parses operands for instructions of assembler syntax:
	 *		<MLA>{cond}{S} Rd,Rm,Rs,Rn
	 *
	 *	@S
	 *	 String containing operands.
	 *
	 *	@Return
	 *	 An Object representing the parsed operands.
	 */
	ParseOperands_6: function(S) {
		var R = {};
		var A = S.split(',');
		for(var i in A)
			A[i] = A[i].trim();
		if(A.length != 4)
			throw new SyntaxError('invalid instruction syntax');
		for(var i = 1; i < 5; i++) {
			R['Op' + i] = ARMv4T.Assembler.ParseRegister(A[i - 1]);
			if(R['Op' + i] == 'R15')
				throw new Error('R15 must not be used as operand');
		}
		if(R['Op1'] == R['Op2'])
			throw new Error('destination register must not be the same as operand');
		return R;
	},

	/*
	 * ARMv4T.Assembler.ParseOperands_7
	 *	Parses operands for instructions of assembler syntax:
	 *		<UMULL|MLAL|Etc.>{cond}{S} RdLo,RdHi,Rm,Rs
	 *
	 *	@S
	 *	 String containing operands.
	 *
	 *	@Return
	 *	 An Object representing the parsed operands.
	 */
	ParseOperands_7: function(S) {
		var R = {};
		var A = S.split(',');
		for(var i in A)
			A[i] = A[i].trim();
		if(A.length != 4)
			throw new SyntaxError('invalid instruction syntax');
		var E = {};
		for(var i = 1; i < 5; i++) {
			R['Op' + i] = ARMv4T.Assembler.ParseRegister(A[i - 1]);
			if(R['Op' + i] == 'R15')
				throw new Error('R15 must not be used as operand');
			if(E[R['Op' + i]])
				throw new Error('Operands must specify different registers');
			E[R['Op' + i]] = true;
		}
		return R;
	},

	/*
	 * ARMv4T.Assembler.ParseOperands_8
	 *	Parses operands for instructions of assembler syntax:
	 *		<LDR|STR>{cond}{B}{T} Rd,<Address>
	 *
	 *	@S
	 *	 String containing operands.
	 *
	 *	@Return
	 *	 An Object representing the parsed operands.
	 */
	ParseOperands_8: function(S) {
		var R = {};
		S = S.trim();
		if(!S.match(/^(\w+)\s*,\s*(.*)$/i))
			throw new SyntaxError('invalid instruction syntax');
		R['Rd'] = ARMv4T.Assembler.ParseRegister(RegExp.$1);
		var A = ARMv4T.Assembler.ParseAddress(RegExp.$2);
		return ARMv4T.Assembler.MergeObjects(R, A);
	},

	/*
	 * ARMv4T.Assembler.ParseOperands_9
	 *	Parses operands for instructions of assembler syntax:
	 *		<LDM|STM>{cond}<FD|ED|FA|EA|IA|IB|DA|DB> Rn{!},<Rlist>{^} 
	 *
	 *	@S
	 *	 String containing operands.
	 *
	 *	@Return
	 *	 An Object representing the parsed operands.
	 */
	ParseOperands_9: function(S) {
		var R = {};
		S = S.trim();
		if(!S.match(/^(\w+)\s*(!)?\s*,\s*{(.*)}\s*(\^)?$/i))
			throw new SyntaxError('invalid instruction syntax');
		R['Rn'] = ARMv4T.Assembler.ParseRegister(RegExp.$1);
		R['Writeback'] = RegExp.$2 ? true : false;
		R['S'] = RegExp.$4 ? true : false;
		R['RList'] = [];
		/* parse register list */
		var A = RegExp.$3.split(',');
		for(var i in A) {
			var E = A[i].trim();
			if(E.match(/^R(\d{1,2})\s*-\s*R(\d{1,2})$/i)) {
				var A = parseInt(RegExp.$1);
				var B = parseInt(RegExp.$2);
				if(A >= B)
					throw new RangeError('Bad register range');
				if(A > 15 || B > 15)
					throw new SyntaxError('ARM register expected (R0 - R15)');
				for(var c = A; c <= B; c++)
					R['RList'].push('R' + c);
			}
			else
				R['RList'].push(ARMv4T.Assembler.ParseRegister(E));
		}
		return R;
	},

	/*
	 * ARMv4T.Assembler.ParseOperands_10
	 *	Parses operands for instructions of assembler syntax:
	 *		<SWP>{cond}{B} Rd,Rm,[Rn] 
	 *
	 *	@S
	 *	 String containing operands.
	 *
	 *	@Return
	 *	 An Object representing the parsed operands.
	 */
	ParseOperands_10: function(S) {
		var R = {};
		var M = S.trim().match(/^(\w+)\s*,\s*(\w+)\s*,\s*\[\s*(\w+)\s*]$/i);
		if(!M)
			throw new SyntaxError('ARM register identifier expected');
		for(var i = 1; i < 4; i++) {
			R['Op' + i] = ARMv4T.Assembler.ParseRegister(M[i]);
			if(R['Op' + i] == 'R15')
				throw new Error('R15 must not be used as operand');
		}
		return R;
	},

	/*
	 * ARMv4T.Assembler.ParseOperands_11
	 *	Parses operands for instructions of assembler syntax:
	 *		CDP{cond} p#,<expression1>,cd,cn,cm{,<expression2>}
	 *
	 *	@S
	 *	 String containing operands.
	 *
	 *	@Return
	 *	 An Object representing the parsed operands.
	 */
	ParseOperands_11: function(S) {
		var R = {};
		var A = S.split(',');
		for(var i in A)
			A[i] = A[i].trim();
		if(A.length < 5 || A.length > 6)
			throw new SyntaxError('Invalid instruction syntax');	
		if(A[0][0].toUpperCase() != 'P')
			throw new SyntaxError('Coprocessor number expected');
		R['CP'] = parseInt(A[0].substr(1));
		if(R['CP'] > 15)
			throw new Error('Coprocessor number out of range');
		var T = ARMv4T.Assembler.ParseExpression(A[1]);
		if(T > 15)
			throw new RangeError('Expression out of range');
		R['CPOpc'] = T;
		R['Cd'] = ARMv4T.Assembler.ParseCPRegister(A[2]);
		R['Cn'] = ARMv4T.Assembler.ParseCPRegister(A[3]);
		R['Cm'] = ARMv4T.Assembler.ParseCPRegister(A[4]);
		if(A.length == 6) {
			T = ARMv4T.Assembler.ParseExpression(A[5]);
			if(T > 7)
				throw new RangeError('Expression out of range');
			R['CPType'] = T;
		}
		return R;
	},

	/*
	 * ARMv4T.Assembler.ParseOperands_12
	 *	Parses operands for instructions of assembler syntax:
	 *		<LDC|STC>{cond}{L} p#,cd,<Address>
	 *
	 *	@S
	 *	 String containing operands.
	 *
	 *	@Return
	 *	 An Object representing the parsed operands.
	 */
	ParseOperands_12: function(S) {
		var R = {};
		if(!S.trim().match(/^P(\d{1,2})\s*,\s*(\w+)\s*,\s*(.*)$/i))
			throw new SyntaxError('Invalid instruction syntax');
		R['CP'] = parseInt(RegExp.$1);
		if(R['CP'] > 15)
			throw new Error('Coprocessor number out of range');
		R['Cd'] = ARMv4T.Assembler.ParseCPRegister(RegExp.$2);
		var A = ARMv4T.Assembler.ParseAddress(RegExp.$3.trim());
		if(A.Offset > 0xFF)
			throw new RangeError('Coprocessor offset out of range');
		if(A.Shift)
			throw new SyntaxError('Invalid coprocessor offset');
		return ARMv4T.Assembler.MergeObjects(A, R);
	},

	/*
	 * ARMv4T.Assembler.ParseOperands_13
	 *	Parses operands for instructions of assembler syntax:
	 *		<MCR|MRC>{cond} p#,<expression1>,Rd,cn,cm{,<expression2>}
	 *
	 *	@S
	 *	 String containing operands.
	 *
	 *	@Return
	 *	 An Object representing the parsed operands.
	 */
	ParseOperands_13: function(S) {
		var R = {};
		var A = S.split(',');
		for(var i in A)
			A[i] = A[i].trim();
		if(A.length < 5 || A.length > 6)
			throw new SyntaxError('Invalid instruction syntax');
		if(A[0][0].toUpperCase() != 'P')
			throw new SyntaxError('Coprocessor number expected');
		R['CP'] = parseInt(A[0].substr(1));
		if(R['CP'] > 15)
			throw new Error('Coprocessor number out of range');
		var T = ARMv4T.Assembler.ParseExpression(A[1]);
		if(T > 15)
			throw new RangeError('Expression out of range');
		R['CPOpc'] = T;
		R['Rd'] = ARMv4T.Assembler.ParseRegister(A[2]);
		R['Cn'] = ARMv4T.Assembler.ParseCPRegister(A[3]);
		R['Cm'] = ARMv4T.Assembler.ParseCPRegister(A[4]);
		if(A.length == 6) {
			T = ARMv4T.Assembler.ParseExpression(A[5]);
			if(T > 7)
				throw new RangeError('Expression out of range');
			R['CPType'] = T;
		}
		return R;
	},

	/*
	 * ARMv4T.Assembler.ParseOperands_14
	 *	Parses operands for instructions of assembler syntax:
	 *		<MOV|MVN|Etc.>{cond}{S} Rd,<Op2>
	 *
	 *	@S
	 *	 String containing the operands.
	 *
	 *	@Return:
	 *	 Returns an object representing the parsed operands.
	 */
	ParseOperands_14: function(S) {
		var R = {};
		var A = S.split(',');
		for(var i in A)
			A[i] = A[i].trim();
		if(A.length == 1)
			throw new SyntaxError('Invalid instruction syntax');
		R['Rd'] = ARMv4T.Assembler.ParseRegister(A[0]);
		var IsRotated = false;
		try {
			R['Op2'] = ARMv4T.Assembler.ParseRegister(A[1]);
		} catch(e) {
			var T	= ARMv4T.Assembler.ParseExpression(A[1]);
			var Enc = ARMv4T.Assembler.EncodeImmediate(T);

			IsRotated = Enc.Rotate > 0;
			R['Immediate'] = true;
			R['Op2'] = Enc;
		}
		if(A.length == 2)
			return R;
		if(R['Immediate']) {
			if(IsRotated)
				throw new Error('Illegal shift on rotated value');
			var T = ARMv4T.Assembler.ParseExpression(A[2]);
			if((T % 2) || T < 0 || T > 30)
				throw new Error('Invalid rotation: ' + T);
			R['Op2'].Rotate = T / 2;
		} else {
			if(A[2].match(/^(ASL|LSL|LSR|ASR|ROR)\s*(.*)$/i)) {
				R['ShiftOp'] = RegExp.$1;
				var F = RegExp.$2;
				try {
					R['Shift'] = ARMv4T.Assembler.ParseRegister(F);
				} catch(e) {
					T = ARMv4T.Assembler.ParseExpression(F);
					if(T > 31)
						throw new Error('Expression out of range');
					R['Shift'] = T;
				}
			}
			else if(A[2].match(/^RRX$/i)) {
				R['Rrx'] = true;
			}
			else
				throw new SyntaxError('Invalid expression');
		}
		if(A.length > 3)
			throw new SyntaxError('Invalid instruction syntax');
		return R;
	},

	/*
	 * ARMv4T.Assembler.ParseOperands_15
	 *	Parses operands for instructions of assembler syntax:
	 *		<NOP>
	 *
	 *	@S
	 *	 String containing operands.
	 *
	 *	@Return
	 *	 An Object representing the parsed operands.
	 */
	ParseOperands_15: function(S) {
		return {};
	},

	/*
	 * ARMv4T.Assembler.ParseOperands_16
	 *	Parses operands for instructions of assembler syntax:
	 *		<PUSH|POP> <Rlist>
	 *
	 *	@S
	 *	 String containing operands.
	 *
	 *	@Return
	 *	 An Object representing the parsed operands.
	 */
	ParseOperands_16: function(S) {
		/* PUSH/POP are just assembler shortcuts for
			STMFD SP! and LDMFD SP!, respectively */
		if(!S.trim().match(/^{(.*)}\s*$/i))
			throw new SyntaxError('invalid instruction syntax');
		var R = { Rn: 'R13', Writeback: true, Mode:'FD' };
		R['RList'] = [];
		var A = RegExp.$1.split(',');
		for(var i in A) {
			var E = A[i].trim();
			if(E.match(/^R(\d{1,2})\s*-\s*R(\d{1,2})$/i)) {
				var From = parseInt(RegExp.$1);
				var To = parseInt(RegExp.$2);
				if(From >= To)
					throw new RangeError('Bad register range');
				if(From > 15 || To > 15)
					throw new SyntaxError('ARM register expected (R0 - R15)');
				for(var c = From; c <= To; c++)
					R['RList'].push('R' + c);
			}
			else
				R['RList'].push(ARMv4T.Assembler.ParseRegister(E));
		}		
		return R;
	},

	/*
	 * ARMv4T.Assembler.ParseOperands_17
	 *	Parses operands for instructions of assembler syntax:
	 *		<LSL|LSR|ASR|ROR>{Cond}{S} Rd, Rn, Shift
	 *
	 *	@S
	 *	 String containing operands.
	 *
	 *	@Return
	 *	 An Object representing the parsed operands.
	 */
	ParseOperands_17: function(S) {
		var R = {};
		var A = S.split(',');
		for(var i in A)
			A[i] = A[i].trim();
		if(A.length < 2 || A.length > 3)
			throw new SyntaxError('Invalid instruction syntax');
		R['Rd'] = ARMv4T.Assembler.ParseRegister(A[0]);
		var isReg = false;
		try {
			R['Op2'] = ARMv4T.Assembler.ParseRegister(A[1]);
			isReg = true;
		} catch(e) {
			R['Op2'] = R['Rd'];
			R['Shift'] = ARMv4T.Assembler.ParseExpression(A[1]);
			/* ShiftOp will be resolved in pass 1 */
			return R;
		}
		if(isReg && A.length == 2)
			throw new SyntaxError('Shift expression expected');
		R['Shift'] = ARMv4T.Assembler.ParseExpression(A[2]);
		return R;
	},

	/*
	 * ARMv4T.Assembler.ParseOperands_18
	 *	Parses operands for instructions of assembler syntax:
	 *		<RRX>{Cond}{S} Rd, Rn
	 *
	 *	@S
	 *	 String containing operands.
	 *
	 *	@Return
	 *	 An Object representing the parsed operands.
	 */
	ParseOperands_18: function(S) {
		var R = {};
		var A = S.split(',');
		for(var i in A)
			A[i] = A[i].trim();
		if(A.length != 2)
			throw new SyntaxError('Invalid instruction syntax');
		R['Rd'] = ARMv4T.Assembler.ParseRegister(A[0]);
		R['Op2'] = ARMv4T.Assembler.ParseRegister(A[1]);
		R['Rrx'] = true;
		return R;
	},

	/*
	 * ARMv4T.Assembler.ParseOperands_19
	 *	Parses operands for instructions of assembler syntax:
	 *		<CMP|TEQ|Etc.>{cond}{S} Rn,<Op2>
	 *
	 *	@S
	 *	 String containing the operands.
	 *
	 *	@Return:
	 *	 Returns an object representing the parsed operands.
	 */
	ParseOperands_19: function(S) {
		var R = {};
		var A = S.split(',');
		for(var i in A)
			A[i] = A[i].trim();
		if(A.length == 1)
			throw new SyntaxError('Invalid instruction syntax');
		R['Rn'] = ARMv4T.Assembler.ParseRegister(A[0]);
		var IsRotated = false;
		try {
			R['Op2'] = ARMv4T.Assembler.ParseRegister(A[1]);
		} catch(e) {
			var T	= ARMv4T.Assembler.ParseExpression(A[1]);
			var Enc = ARMv4T.Assembler.EncodeImmediate(T);

			IsRotated = Enc.Rotate > 0;
			R['Immediate'] = true;
			R['Op2'] = Enc;
		}
		if(A.length == 2)
			return R;
		if(R['Immediate']) {
			if(IsRotated)
				throw new Error('Illegal shift on rotated value');
			var T = ARMv4T.Assembler.ParseExpression(A[2]);
			if((T % 2) || T < 0 || T > 30)
				throw new Error('Invalid rotation: ' + T);
			R['Op2'].Rotate = T / 2;
		} else {
			if(A[2].match(/^(ASL|LSL|LSR|ASR|ROR)\s*(.*)$/i)) {
				R['ShiftOp'] = RegExp.$1;
				var F = RegExp.$2;
				try {
					R['Shift'] = ARMv4T.Assembler.ParseRegister(F);
				} catch(e) {
					T = ARMv4T.Assembler.ParseExpression(F);
					if(T > 31)
						throw new Error('Expression out of range');
					R['Shift'] = T;
				}
			}
			else if(A[2].match(/^RRX$/i)) {
				R['Rrx'] = true;
			}
			else
				throw new SyntaxError('Invalid expression');
		}
		if(A.length > 3)
			throw new SyntaxError('Invalid instruction syntax');
		return R;
	},
		
	/*
	 * ARMv4T.Assembler.EncodeImmediate
	 *	Attempts to encode 32-bit value as a rotated immediate
	 *	operand as expected by ARM data processing instructions.
	 *	If this is not possible, an exception is thrown.
	 *
	 *	For details, consult ARM7TDMI-S Data Sheet, 4.5.3
	 *
	 * @V
	 *	32-bit value to encode
	 *
	 * @Return
	 *	Object containing an 8-bit immediate value as well as
	 *	a 4-bit unsigned rotate value.
	 */
	EncodeImmediate: function(V) {
		function RotateRight(V, N) {
			for(var i = 0; i < N; i++)
				V = (V >>> 1) | ((V & 0x01) << 31);
			return V;
		}
		function RotateLeft(V, N) {
			for(var i = 0; i < N; i++)
				V = (V << 1) | ((V >> 31) & 0x01);
			return V;
		}
		var M = ((V >>> 31) & 0x01) ? true : false;
		if(M)
			V = ~V; /* peform logical not and use MVN instead of MOV */
		var L = null;
		for(var i = 0; i < 16; i++) {
			V = RotateRight(V, 2);
			if(V >= 0 && V < 256)
				L = { Immediate:V, Rotate:(15 - i), Negative:M };
		}
		if(L == null)
			throw new Error('invalid constant 0x' + Math.abs(V).toString(16));
		return L;
	},

	/*
	 * ARMv4T.Assembler.ParseAddress
	 *	Parses an adress as is accepted by instructions such as
	 *	LDR and STR.
	 *
	 *	@S
	 *	 String containing operands.
	 *
	 *	@Return
	 *	 An Object representing the parsed operands.
	 */
	ParseAddress: function(S) {
		S = S.trim();
		/* expression */
		if(S[0] == '=') {
			return {
				Type: 'Imm',
				Offset: ARMv4T.Assembler.ParseExpression(S.substr(1)),
				Pseudo: true
			}
		}

		/* pre-indexed addressing */
		if(S.match(/^\[\s*(\w+)\s*,\s*(.*)\](!)?$/i)) {
			var Ret = {
				Type: 'Pre',
				Source: ARMv4T.Assembler.ParseRegister(RegExp.$1),
				Writeback: RegExp.$3 ? true : false
			};
			var Tmp = RegExp.$2.trim();
			try {
				Ret['Offset'] = ARMv4T.Assembler.ParseExpression(Tmp);
				Ret['Immediate'] = true;
			} catch(e) {
				var M = Tmp.match(/^([+|-])?\s*(\w+)(\s*,\s*(ASL|LSL|LSR|ASR|ROR)\s*(.*))?$/i);
				if(!M)
					throw new Error('invalid address expression');
				Ret['Subtract'] = M[1] == '-';
				Ret['Offset'] = ARMv4T.Assembler.ParseRegister(M[2]);
				if(M[3]) {
					Ret['ShiftOp'] = M[4].toUpperCase();
					var T = ARMv4T.Assembler.ParseExpression(M[5]);
					if(T > 31)
						throw new Error('shift expression too large');
					Ret['Shift'] = T;
				}
			}
		}
		/* post-indexed addressing */
		else if(S.match(/^\[\s*(\w+)\s*\]\s*(,(.*))?$/i)) {
			var Ret = {
				Type: 'Post',
				Source: ARMv4T.Assembler.ParseRegister(RegExp.$1)
			};
			if(!RegExp.$2)
				return Ret;
			var Tmp = RegExp.$3.trim();
			try {
				Ret['Offset'] = ARMv4T.Assembler.ParseExpression(Tmp);
				Ret['Immediate'] = true;
			} catch(e) {
				var M = Tmp.match(/^([+|-])?\s*(\w+)(\s*,\s*(ASL|LSL|LSR|ASR|ROR)\s*(.*))?$/i);
				Ret['Subtract'] = M[1] == '-';
				Ret['Offset'] = ARMv4T.Assembler.ParseRegister(M[2]);
				if(M[3]) {
					Ret['ShiftOp'] = M[4].toUpperCase();
					var T = ARMv4T.Assembler.ParseExpression(M[5]);
					if(T > 31)
						throw new Error('shift expression too large');
					Ret['Shift'] = T;
				}
			}
		}
		else {
			/* labels evaluate to PC-relative addressing */
			var Addr = ARMv4T.Assembler.Symbols.Get(S);
			if(Addr) {
				var Dist = Addr - ARMv4T.Assembler.Sections['.TEXT'].Pos;
				return {
					Type: 'Pre',
					Source: 'R15',
					Immediate: true,
					Offset: Dist
				};
			}
			/* give up */
			else
				throw new SyntaxError('invalid address expression');
		}
		return Ret;
	},

	/*
	 * ARMv4T.Assembler.BuildInstruction_0
	 *	Builds ARM instruction word for BX instruction
	 *
	 *	@O
	 *	 Object describing instruction
	 *
	 *	@Return
	 *	 32-bit ARM instruction word.
	 */
	BuildInstruction_0: function(O) {
		var BX_Mask = 0x12FFF10;
		var Cm = ARMv4T.Assembler.ConditionMask(O.Condition);
		var Rn = parseInt(O.Rn.substr(1));
		return ((Cm << 28) | BX_Mask | Rn);
	},

	/*
	 * ARMv4T.Assembler.BuildInstruction_1
	 *	Builds ARM instruction word for B and BL instructions
	 *
	 *	@O
	 *	 Object describing instruction
	 *
	 *	@Return
	 *	 32-bit ARM instruction word.
	 */
	BuildInstruction_1: function(O) {
		var L = O.Mnemonic == 'BL' ? 1 : 0;
		var Mask = 0xA000000;
		var Cm = ARMv4T.Assembler.ConditionMask(O.Condition);
    // Branch offsets are relative with respect to the position of
    // the instruction.
    var RelOffset = O.Offset - ARMv4T.Assembler.Sections['.TEXT'].Pos - 8;
    var Of = (RelOffset >>> 2) & 0xFFFFFF;
		return ((Cm << 28) | (L << 24) | Mask | Of);
	},

	/*
	 * ARMv4T.Assembler.BuildInstruction_2
	 *	Builds ARM instruction word for data processing instructions
	 *	(AND, ADD, MOV, Etc.)
	 *
	 *	@O
	 *	 Object describing instruction
	 *
	 *	@Return
	 *	 32-bit ARM instruction word.
	 */
	BuildInstruction_2: function(O) {
		var Opcodes = {
			'AND':0,  'EOR':1,  'SUB':2,  'RSB':3,  'ADD':4,  'ADC':5,
			'SBC':6,  'RSC':7,  'ORR':12, 'MOV':13, 'BIC':14, 'MVN':15
		};
		var Cm  = ARMv4T.Assembler.ConditionMask(O.Condition);
		var S	= O.S ? 1 : 0;
		var I	= O.Immediate ? 1 : 0;
		var Rd	= parseInt(O.Rd.substr(1));
		var Rn	= O.Rn ? parseInt(O.Rn.substr(1)) : 0; // some operations igore Rn field
		var Op2 = 0;
		if(I) {
			if(O.Mnemonic == 'MOV' && O.Op2.Negative)
				O.Mnemonic = 'MVN';
			else if(O.Mnemonic == 'MVN' && !O.Op2.Negative)
				O.Mnemonic = 'MOV';
			Op2 = (O.Op2.Rotate << 8) | O.Op2.Immediate;
		} else {
			var Stypes = {'LSL':0, 'LSR':1, 'ASL':0, 'ASR':2, 'ROR':3};
			var Sf = 0;
			if(O.Shift && O.ShiftOp) {
				var St = Stypes[O.ShiftOp];
				if(ARMv4T.Assembler.IsRegister(O.Shift))
					Sf = (parseInt(O.Shift.substr(1)) << 4) | (St << 1) | (1);
				else
					Sf = (O.Shift << 3) | (St << 1);
			}
			Op2 = (Sf << 4) | parseInt(O.Op2.substr(1));
		}
		var Opc = Opcodes[O.Mnemonic];
		/* TST, TEQ, CMP, CMN always MUST have the S flag set */
		if(Opc > 7 && Opc < 12)
			S = 1;
		return ((Cm << 28) | (I << 25) | (Opc << 21) |
			(S << 20) | (Rn << 16) | (Rd << 12) | (Op2));
	},

	/*
	 * ARMv4T.Assembler.BuildInstruction_3
	 *	Builds ARM instruction word for MRS instruction
	 *
	 *	@O
	 *	 Object describing instruction
	 *
	 *	@Return
	 *	 32-bit ARM instruction word.
	 */
	BuildInstruction_3: function(O) {
		var Cm = ARMv4T.Assembler.ConditionMask(O.Condition);
		var Rd = parseInt(O.Rd.substr(1));
		var P = (O.P == 'CPSR' || O.P == 'CPSR_ALL') ? 0 : 1;
		var Mask = 0x10F0000;
		return ((Cm << 28) | (P << 22) | (Rd << 12) | Mask);
	},

	/*
	 * ARMv4T.Assembler.BuildInstruction_4
	 *	Builds ARM instruction word for MSR instruction
	 *
	 *	@O
	 *	 Object describing instruction
	 *
	 *	@Return
	 *	 32-bit ARM instruction word.
	 */
	BuildInstruction_4: function(O) {
		var Cm = ARMv4T.Assembler.ConditionMask(O.Condition);
		var R  = 0;
		/* flag bits only */
		if(O.P == 'CPSR_FLG' || O.P == 'SPSR_FLG') {
			var I = ARMv4T.Assembler.IsRegister(O.Op2) == false;
			var P = (O.P == 'CPSR_FLG') ? 0 : 1;
			var S = 0;
			var Mask = 0x128F000;
			if(!I)
				S = parseInt(O.Op2.substr(1));
			else {
				/* ARM ARM7TDMI-S Data Sheet 4.6.4 */
				/* Wie wird 32-Bit konstante erzeugt mit 4 Shiftbits
					und 8 bit immediate? */
				throw new Error('Not implemented');
			}
			R = (Cm << 28) | (I << 25) | (P << 22) | Mask | S;
		} else {
			var P = (O.P == 'CPSR' || O.P == 'CPSR_ALL') ? 0 : 1;
			var Rm = parseInt(O.Op2.substr(1));
			var Mask = 0x129F000;
			R = (Cm << 28) | (P << 22) | Mask | Rm;
		}
		return R;
	},

	/*
	 * ARMv4T.Assembler.BuildInstruction_5
	 *	Builds ARM instruction word for MUL and MLA instructions
	 *
	 *	@O
	 *	 Object describing instruction
	 *
	 *	@Return
	 *	 32-bit ARM instruction word.
	 */
	BuildInstruction_5: function(O) {
		var Cm = ARMv4T.Assembler.ConditionMask(O.Condition);
		var A = O.Mnemonic == 'MLA' ? 1 : 0;
		var S = O.S ? 1 : 0;
		var Rd = parseInt(O.Op1.substr(1));
		var Rs = parseInt(O.Op2.substr(1));
		var Rm = parseInt(O.Op3.substr(1));
		var Rn = A ? parseInt(O.Op4.substr(1)) : 0;
		var Mask = 0x90;
		return ((Cm << 28) | (A << 21) | (S << 20) | (Rd << 16) |
				(Rn << 12) | (Rs << 8) | Mask | Rm);
	},

	/*
	 * ARMv4T.Assembler.BuildInstruction_6
	 *	Builds ARM instruction word for UMULL, MLAL, SMULL
	 *	and SMLAL instructions
	 *
	 *	@O
	 *	 Object describing instruction
	 *
	 *	@Return
	 *	 32-bit ARM instruction word.
	 */
	BuildInstruction_6: function(O) {
		var Cm = ARMv4T.Assembler.ConditionMask(O.Condition);
		var RdLo = parseInt(O.Op1.substr(1));
		var RdHi = parseInt(O.Op2.substr(2));
		var Rm = parseInt(O.Op3.substr(1));
		var Rs = parseInt(O.Op4.substr(1));
		var U = (O.Mnemonic == 'UMULL' || O.Mnemonic == 'UMLAL') ? 1 : 0;
		var A = (O.Mnemonic == 'UMLAL' || O.Mnemonic == 'SMLAL') ? 1 : 0;
		var S = O.S ? 1 : 0;
		var Mask = 0x800090;
		return ((Cm << 28) | (U << 22) | (A << 21) | (S << 20) | (RdHi << 16) |
				(RdLo << 12) | (Rs << 8) | Mask | Rm);
	},

	/*
	 * ARMv4T.Assembler.BuildInstruction_7
	 *	Builds ARM instruction word for LDR and STR instructions
	 *
	 *	@O
	 *	 Object describing instruction
	 *
	 *	@Return
	 *	 32-bit ARM instruction word.
	 */
	BuildInstruction_7: function(O) {
		/* H/SH/SB is a different instruction really so dispatch to its
			own routine */
		if(O.Mode && O.Mode.match(/^H|SH|SB$/))
			return ARMv4T.Assembler.BuildInstruction_8(O);
		var Cm = ARMv4T.Assembler.ConditionMask(O.Condition);
		var Rd = parseInt(O.Rd.substr(1));
		var P = O.Type == 'Pre' ? 1 : 0;
		var W = O.Writeback ? 1 : 0;
//		var I = O.Immediate ? 1 : 0;
var I = O.Immediate ? 0 : 1;
		var U = O.Subtract ? 0 : 1;
		var L = O.Mnemonic == 'LDR' ? 1 : 0;
		var B = (O.Mode == 'B' || O.Mode == 'BT') ? 1 : 0;
		/* Resolve pseudo instructions */
		if(O.Pseudo) {
			try {
				/* Build MOV/MVN instruction if value fits into <op2> field */
				var Imm = ARMv4T.Assembler.EncodeImmediate(O.Offset);
				return ARMv4T.Assembler.BuildInstruction_2({
					Immediate: true,
					Mnemonic: Imm.Negative ? 'MVN' : 'MOV',
					Condition: O.Condition || null,
					Op2: Imm,
					Rd: O.Rd
				});
			} catch(e) {
				var LPOffset = ARMv4T.Assembler.Litpools.Put(O.Offset);
				/* Build LDR Rd, [PC + Offset] post-indexed instruction */
				P = W = B = 0;
				I = U = 1;
				O.Source = 'R15';
				O.Offset = LPOffset;
				O.Type = 'Post';
			}
		}
		/* Deal with LDR/STR */
		var Mask	= 0x4000000;
		var Rn		= parseInt(O.Source.substr(1));
		var Offset	= O.Offset || 0;
		console.log(O);
		/* Offset is a (possibly shifted) register */
		if(I == 1 && O.Offset) {
			var Stypes	= {'LSL':0, 'LSR':1, 'ASL':0, 'ASR':2, 'ROR':3};
			var Reg		= parseInt(O.Offset.substr(1));
			var Shift	= O.Shift ? ((O.Shift << 3) | (Stypes[O.ShiftOp] << 1)) : 0;
			Offset = (Shift << 4) | Reg;
		}
		return ((Cm << 28) | Mask | (I << 25) | (P << 24) | (U << 23) |
				(B << 22)  | (W << 21) | (L << 20) | (Rn << 16) |
				(Rd << 12) | Offset);
	},

	/*
	 * ARMv4T.Assembler.BuildInstruction_8
	 *	Builds ARM instruction word for LDR and STR instructions
	 *	(signed byte and halfword variant)
	 *
	 *	@O
	 *	 Object describing instruction
	 *
	 *	@Return
	 *	 32-bit ARM instruction word.
	 */
	BuildInstruction_8: function(O) {
		var Cm = ARMv4T.Assembler.ConditionMask(O.Condition);
		var Mask = 0x90;
		var Rd = parseInt(O.Rd.substr(1));
		var Rn = parseInt(O.Source.substr(1));
		var L = O.Mnemonic == 'LDR' ? 1 : 0;
		var P = O.Type == 'Pre' ? 1 : 0;
		var W = O.Writeback ? 1 : 0;
		var U = O.Subtract ? 0 : 1;
		var I = O.Immediate ? 1 : 0;
		var Modes = {'H':1, 'SB':2, 'SH': 3};
		var M = Modes[O.Mode];
		var loNibble = 0;
		var hiNibble = 0;
		if(I == 0 && O.Offset)
			loNibble = parseInt(O.Offset.substr(1));
		else if(O.Offset) {
			/* Offset is unsigned 8-bit immediate split into two nibbles */
			loNibble = O.Offset & 0xF;
			hiNibble = (O.Offset >> 4) & 0xF;
		}
		return ((Cm << 28) | (P << 24) | (U << 23) | (W << 21) | (L << 20) |
				(Rn << 16) | (Rd << 12) | (hiNibble << 8) | (M << 5) |
				(loNibble));
	},

	/*
	 * ARMv4T.Assembler.BuildInstruction_9
	 *	Builds ARM instruction word for LDM and STM instructions
	 *
	 *	@O
	 *	 Object describing instruction
	 *
	 *	@Return
	 *	 32-bit ARM instruction word.
	 */
	BuildInstruction_9: function(O) {
		var Cm = ARMv4T.Assembler.ConditionMask(O.Condition);
		var Mask = 0x8000000;
		var Rn = parseInt(O.Rn.substr(1));
		var W = O.Writeback ? 1 : 0;
		var S = O.S ? 1 : 0;
		var Modes = {
			'LDMED':[1, 1, 1], 'LDMFD':[1, 0, 1], 'LDMEA':[1, 1, 0],
			'LDMFA':[1, 0, 0], 'LDMIB':[1, 1, 1], 'LDMIA':[1, 0, 1],
			'LDMDB':[1, 1, 0], 'LDMDA':[1, 0, 0],
			'STMFA':[0, 1, 1], 'STMEA':[0, 0, 1], 'STMFD':[0, 1, 0],
			'STMED':[0, 0, 0], 'STMIB':[0, 1, 1], 'STMIA':[0, 0, 1],
			'STMDB':[0, 1, 0], 'STMDA':[0, 0, 0]
		};
		var M = Modes[O.Mnemonic + O.Mode];
		var L = M[0];
		var P = M[1];
		var U = M[2];
		var RList = 0;
		for(var i = 0; i < O.RList.length; i++) {
			var Reg = parseInt(O.RList[i].substr(1));
			RList |= (1 << Reg);
		}
		return ((Cm << 28) | Mask | (P << 24) | (U << 23) | (S << 22) | (W << 21) |
				(L << 20) | (Rn << 16) | RList);
	},

	/*
	 * ARMv4T.Assembler.BuildInstruction_10
	 *	Builds ARM instruction word for SWP instruction
	 *
	 *	@O
	 *	 Object describing instruction
	 *
	 *	@Return
	 *	 32-bit ARM instruction word.
	 */
	BuildInstruction_10: function(O) {
		var Cm = ARMv4T.Assembler.ConditionMask(O.Condition);
		var Mask = 0x1000090;
		var B = O.B ? 1 : 0;
		var Rd = parseInt(O.Op1.substr(1));
		var Rm = parseInt(O.Op2.substr(1));
		var Rn = parseInt(O.Op3.substr(1));
		return ((Cm << 28) | Mask | (B << 22) | (Rn << 16) | (Rd << 12) | Rm);
	},

	/*
	 * ARMv4T.Assembler.BuildInstruction_11
	 *	Builds ARM instruction word for SWI instruction
	 *
	 *	@O
	 *	 Object describing instruction
	 *
	 *	@Return
	 *	 32-bit ARM instruction word.
	 */
	BuildInstruction_11: function(O) {
		var Cm = ARMv4T.Assembler.ConditionMask(O.Condition);
		var Mask = 0xF000000;
		return ((Cm << 28) | Mask | O.Offset);
	},

	/*
	 * ARMv4T.Assembler.BuildInstruction_12
	 *	Builds ARM instruction word for CDP instruction
	 *
	 *	@O
	 *	 Object describing instruction
	 *
	 *	@Return
	 *	 32-bit ARM instruction word.
	 */
	BuildInstruction_12: function(O) {
		var Cm = ARMv4T.Assembler.ConditionMask(O.Condition);
		var Mask = 0xE000000;
		var Cn = parseInt(O.Cn.substr(1));
		var Cm = parseInt(O.Cm.substr(1));
		var Cd = parseInt(O.Cd.substr(1));
		var Type = O.CPType || 0;
		return ((Cm << 28) | Mask | (O.CPOpc << 20) | (Cn << 16) | (Cd << 12) |
				(O.CP << 8) | (Type << 5) | Cm);
	},

	/*
	 * ARMv4T.Assembler.BuildInstruction_13
	 *	Builds ARM instruction word for LDC and STC instructions
	 *
	 *	@O
	 *	 Object describing instruction
	 *
	 *	@Return
	 *	 32-bit ARM instruction word.
	 */
	BuildInstruction_13: function(O) {
		var Cm = ARMv4T.Assembler.ConditionMask(O.Condition);
		var Mask = 0xC000000;
		var N = O.L ? 1 : 0;
		var Cd = parseInt(O.Cd.substr(1));
		var Rn = parseInt(O.Source.substr(1));
		var L = O.Mnemonic == 'LDC' ? 1 : 0;
		var P = O.Type == 'Pre' ? 1 : 0;
		var W = O.Writeback ? 1 : 0;
		var U = O.Subtract ? 0 : 1;
		return ((Cm << 28) | Mask | (P << 24) | (U << 23) | (N << 22) | (W << 21) |
				(L << 20) | (Rn << 16) | (Cd << 12) | (O.CP << 8) | O.Offset);
	},

	/*
	 * ARMv4T.Assembler.BuildInstruction_14
	 *	Builds ARM instruction word for MRC and MCR instructions
	 *
	 *	@O
	 *	 Object describing instruction
	 *
	 *	@Return
	 *	 32-bit ARM instruction word.
	 */
	BuildInstruction_14: function(O) {
		var Cm = ARMv4T.Assembler.ConditionMask(O.Condition);
		var Mask = 0xE000010;
		var L = O.Mnemonic == 'MRC' ? 1 : 0;
		var Rd = parseInt(O.Rd.substr(1));
		var Cn = parseInt(O.Cn.substr(1));
		var Cm = parseInt(O.Cm.substr(1));
		var Type = O.CPType || 0;
		return ((Cm << 28) | Mask | (O.CPOpc << 21) | (L << 20) | (Cn << 16) |
				(Rd << 12) | (O.CP << 8) | (Type << 5) | Cm);
	},

	/*
	 * ARMv4T.Assembler.BuildInstruction_15
	 *	Builds ARM instruction word for PUSH and POP
	 *	pseudo-instructions
	 *
	 *	@O
	 *	 Object describing instruction
	 *
	 *	@Return
	 *	 32-bit ARM instruction word.
	 */
	BuildInstruction_15: function(O) {
		if(O.Mnemonic == 'PUSH')
			O.Mnemonic = 'STM';
		else
			O.Mnemonic = 'LDM';
		return ARMv4T.Assembler.BuildInstruction_9(O);
	},

	/*
	 * ARMv4T.Assembler.BuildInstruction_16
	 *	Builds ARM instruction word for LSL, LSR, ASR and ROR
	 *	pseudo-instructions which just expand to MOV instructions
	 *	with rotations and no other operation
	 *
	 *	@O
	 *	 Object describing instruction
	 *
	 *	@Return
	 *	 32-bit ARM instruction word.
	 */
	BuildInstruction_16: function(O) {
		O['ShiftOp'] = O.Mnemonic;
		O.Mnemonic = 'MOV';
		return ARMv4T.Assembler.BuildInstruction_2(O);
	},

	/*
	 * ARMv4T.Assembler.BuildInstruction_17
	 *	Builds ARM instruction word for RRX pseudo
	 *	instruction which just expands to a MOV instruction
	 *	with RRX rotation and no other operation
	 *
	 *	@O
	 *	 Object describing instruction
	 *
	 *	@Return
	 *	 32-bit ARM instruction word.
	 */
	BuildInstruction_17: function(O) {
		O.Rrx = true;
		O.Mnemonic = 'MOV';
		return ARMv4T.Assembler.BuildInstruction_2(O);
	},

	/*
	 * ARMv4T.Assembler.BuildInstruction_18
	 *	Builds ARM instruction word for NOP pseudo
	 *	instruction which just expands to a MOV R0, R0
	 *	operation.
	 *
	 *	@O
	 *	 Object describing instruction
	 *
	 *	@Return
	 *	 32-bit ARM instruction word.
	 */
	BuildInstruction_18: function(O) {
		return ARMv4T.Assembler.BuildInstruction_2({
			Mnemonic: 'MOV', Rd: 'R0', Op2: 'R0'
		});
	},

	/*
	 * ARMv4T.Assembler.BuildInstruction_2
	 *	Builds ARM instruction word for data processing instructions
	 *	(CMP, CMN, TEQ, TST)
	 *
	 *	@O
	 *	 Object describing instruction
	 *
	 *	@Return
	 *	 32-bit ARM instruction word.
	 */
	BuildInstruction_19: function(O) {
		var Opcodes = { 'TST':8,  'TEQ':9,  'CMP':10, 'CMN':11 };
		var Cm  = ARMv4T.Assembler.ConditionMask(O.Condition);
		var S	= O.S ? 1 : 0;
		var I	= O.Immediate ? 1 : 0;
		var Rn	= parseInt(O.Rn.substr(1));
    var Rd  = 0; // SBZ?
		var Op2 = 0;
		if(I) {
			if(O.Mnemonic == 'MOV' && O.Op2.Negative)
				O.Mnemonic = 'MVN';
			else if(O.Mnemonic == 'MVN' && !O.Op2.Negative)
				O.Mnemonic = 'MOV';
			Op2 = (O.Op2.Rotate << 8) | O.Op2.Immediate;
		} else {
			var Stypes = {'LSL':0, 'LSR':1, 'ASL':0, 'ASR':2, 'ROR':3};
			var Sf = 0;
			if(O.Shift && O.ShiftOp) {
				var St = Stypes[O.ShiftOp];
				if(ARMv4T.Assembler.IsRegister(O.Shift))
					Sf = (parseInt(O.Shift.substr(1)) << 4) | (St << 1) | (1);
				else
					Sf = (O.Shift << 3) | (St << 1);
			}
			Op2 = (Sf << 4) | parseInt(O.Op2.substr(1));
		}
		var Opc = Opcodes[O.Mnemonic];
		/* TST, TEQ, CMP, CMN always MUST have the S flag set */
		if(Opc > 7 && Opc < 12)
			S = 1;
		return ((Cm << 28) | (I << 25) | (Opc << 21) |
			(S << 20) | (Rn << 16) | (Rd << 12) | (Op2));
	},

	/*
	 * ARMv4T.Assembler.Directives
	 *	List of directives accepted by assembler
	 */
	Directives: [
		'ARM', 'THUMB', 'CODE32', 'CODE16', 'FORCE_THUMB', 'THUMB_FUNC',
		'LTORG', 'EQU', 'SET', 'BYTE', 'WORD', 'HWORD', '2BYTE', '4BYTE',
		'ASCII', 'ASCIZ', 'DATA', 'TEXT', 'END', 'EXTERN', 'GLOBAL',
		'INCLUDE', 'SKIP', 'REG', 'ALIGN', 'SECTION', 'FILE', 'RODATA',
		'BSS', 'FUNC', 'ENDFUNC'
	],

	/*
	 * ARMv4T.Assembler.ParseDirective0
	 *	Parses directives such as .section or .word on pass 0.
	 *	Most directives are ignored during pass 0.
	 *
	 *	@D
	 *	 ARM Assembler directive
	 *
	 *	@P
	 *	 Possible parameters expected by directive
	 *
	 *	@Return
	 *		Returns true if directive should be removed from the
	 *		source buffer, false otherwise.
	 */
	ParseDirective0: function(D, P) {
		if(ARMv4T.Assembler.Pass != 0) {
			throw new Error('ParseDirective0 called with Pass = ' +
				ARMv4T.Assembler.Pass);
		}
		D = D.toUpperCase().trim();
		if(ARMv4T.Assembler.Directives.indexOf(D) < 0)
			throw new Error('Invalid assembler directive: ' + D);
		
		var E = {'BYTE':1,'HWORD':2,'WORD':4,'2BYTE':2,'4BYTE':4};
		if(D == 'SECTION') {
			P = P.toUpperCase().trim();
			if(P == '.RODATA' || P == '.BSS')
				P = '.DATA';
				if(!ARMv4T.Assembler.Sections[P])
					throw new Error('Invalid argument for .SECTION: ' + P);
				ARMv4T.Assembler.Section = P;
		}
		else if(D == 'DATA' || D == 'TEXT') {
			ARMv4T.Assembler.Section = '.' + D;
		}
		else if(D == 'RODATA' || D == 'BSS') {
			ARMv4T.Assembler.Section = '.DATA';
		}
		else if(D == 'EQU' || D == 'SET') {
			ARMv4T.Assembler.ParseEQU(P);
			return true;
		}
		else if (E[D]) {
			var Count = P.split(',').length * E[D];
			/* Advance section pointer */
			ARMv4T.Assembler.Sections[ARMv4T.Assembler.Section]
				.Size += Count;
		}
		else if(D == 'ASCII' || D == 'ASCIZ') {
			var is_in_quotes = false;
			var chars = 0, strings = 1;
			for(var i = 0; i < P.length; i++) {
				if(P[i] == '"' && P[i - 1] != '\\') {
					is_in_quotes = !is_in_quotes;
					continue;
				}
				if(is_in_quotes)
					chars++;
				if(P[i] == ',' && !is_in_quotes)
					strings++;
			}
			var Count = chars;
			if(D == 'ASCIZ')
				Count = Count + strings; /* null character */
			ARMv4T.Assembler.Sections[ARMv4T.Assembler.Section]
				.Size += Count;
		}
		else if(D == 'ALIGN') {
			var T = ARMv4T.Assembler.Sections[ARMv4T.Assembler.Section]
				.Size;
			var Align = 4;
			if(P) {
				Align = parseInt(eval(P));
				if(isNaN(Align))
					throw new Error('Invalid alignment for .ALIGN directive');
			}
			if(T % Align) {
				ARMv4T.Assembler.Sections[ARMv4T.Assembler.Section]
					.Size = T + Align - (T % Align);
			}
		}
		else if(D == 'SKIP') {
			if(!P)
				throw new Error('Missing argument for .SKIP');
			P = parseInt(eval(P));
			if(isNaN(P))
				throw new Error('Invalid argument for .SKIP directive');
			ARMv4T.Assembler.Sections[ARMv4T.Assembler.Section]
				.Size += P;
		}
		return false;
	},

	/*
	 * ARMv4T.Assembler.ParseDirective1
	 *	Parses directives such as .section or .word on pass 1.
	 *	Some directives will have already been processed
	 *	during pass 0.
	 *
	 *	@D
	 *	 ARM Assembler directive
	 *
	 *	@P
	 *	 Possible parameters expected by directive
	 *
	 *	@Return
	 *	 Nothing.
	 */
	ParseDirective1: function(D, P) {
		if(ARMv4T.Assembler.Pass != 1) {
			throw new Error('ParseDirective1 called with Pass = ' +
				ARMv4T.Assembler.Pass);
		}
		D = D.toUpperCase().trim();
		if(ARMv4T.Assembler.Directives.indexOf(D) < 0)
			throw new Error('Invalid assembler directive: ' + D);
		var E = {'BYTE':1,'HWORD':2,'WORD':4,'2BYTE':2,'4BYTE':4};
		if(D == 'SECTION') {
			P = P.toUpperCase().trim();
			if(P == '.RODATA' || P == '.BSS')
				P = '.DATA';
				if(!ARMv4T.Assembler.Sections[P])
					throw new Error('Invalid argument for .SECTION: ' + P);
				ARMv4T.Assembler.Section = P;
		}
		else if(D == 'DATA' || D == 'TEXT') {
			ARMv4T.Assembler.Section = '.' + D;
		}
		else if(D == 'RODATA' || D == 'BSS') {
			ARMv4T.Assembler.Section = '.DATA';
		}
		else if (E[D]) {
			ARMv4T.Assembler.ParseData(D, P);
		}
		else if(D == 'ASCII' || D == 'ASCIZ') {
			ARMv4T.Assembler.ParseStrings(D, P);
		}
		else if(D == 'ALIGN') {
			var T = ARMv4T.Assembler.Sections[ARMv4T.Assembler.Section]
				.Pos;
			var Align = 4;
			if(P)
				Align = ARMv4T.Assembler.ParseExpression(P);
			if(T % Align) {
				var Pad = Align - (T % Align);
				for(var i = 0; i < Pad; i++)
					ARMv4T.Assembler.Sections.Write(0x00, 'BYTE');
			}
		}
		else if(D == 'SKIP') {
			if(!P)
				throw new Error('Missing argument for .SKIP');
			P = ARMv4T.Assembler.ParseExpression(P);
			ARMv4T.Assembler.Sections[ARMv4T.Assembler.Section]
				.Pos += P;
		}
	},

	/*
	 * ARMv4T.Assembler.ParseEQU
	 *	Parses .equ directives. Must only be called on pass 0.
	 *
	 *	@P
	 *	 Parameters expected by directive
	 */
	ParseEQU: function(P) {
		P = P.trim();
		if(!P.match(/^(\w+),(.*)$/))
			throw new Error('Invalid arguments for .EQU directive');
		var Name  = RegExp.$1.trim();
		var Value = RegExp.$2.trim();
		/* Replace all occurrences of existing symbol names in equ */
		for(var E in ARMv4T.Assembler.Symbols.Symbols) {
			var O = ARMv4T.Assembler.Symbols.Symbols[E];
			if(O.Type != 'Equ')
				continue;
			Value = Value.replace(new RegExp(E, 'g'), O.Value);
		}
		/* Add to symbol table */
		ARMv4T.Assembler.Symbols.Add({
			'Name':		Name,
			'Type':		'Equ',
			'Value':	Value
		});
		/* Replace all occurrences of equ in existing entries with its' value */
		for(var E in ARMv4T.Assembler.Symbols.Symbols) {
			var O = ARMv4T.Assembler.Symbols.Symbols[E];
			if(E == Name || O.Type != 'Equ')
				continue;
			O.Value = O.Value.replace(new RegExp(Name,'g'), Value);
		}
	},

	/*
	 * ARMv4T.Assembler.ParseData
	 *	Parses data directives. Must only be called on pass 1.
	 *
	 *	@D
	 *	 Directive. Will be one of these:
	 *		.Byte, .HWord, .Word, .2Byte, .4Byte,
	 *		.Ascii or .Asciz (null-terminated string)
	 *
	 *	@L
	 *	 List of comma-seperated data values
	 */
	ParseData: function(D, L) {
		var E = {'BYTE':1,'HWORD':2,'WORD':4,'2BYTE':2,'4BYTE':4};
		D = D.toUpperCase();

		var Max =  ((1 << (E[D] * 8)) - 1) & 0xffffffff;
		var Min = (-(1 << (E[D] * 8 - 1))) & 0xffffffff;
		var N = L.split(',');
		for(var i in N) {
			N[i] = N[i].trim();
			var Num = ARMv4T.Assembler.ParseExpression(N[i]);
			if(Num < Min) {
				console.info('warning 1: ' + Num + ' truncated to ' + Min);
				Num = Min;
			}
//			else if(Num > Max) {
//				console.info('warning 2: ' + Num + ' truncated to ' + Max);
//				Num = Max;
//			}
			ARMv4T.Assembler.Sections.Write(Num, D);
		}
	},

	/*
	 * ARMv4T.Assembler.ParseStrings
	 *	Parses string data directives. Must only be called on pass 1.
	 *
	 *	@D
	 *	 Directive. Will be either ASCII or ASCIZ (null-terminated strings)
	 *
	 *	@L
	 *	 List of comma-seperated strings
	 */
	ParseStrings: function(D, L) {
/*
		D = D.toUpperCase();
		var is_in_quotes = false;
		var chars = 0, strings = 1;
		for(var i = 0; i < L.length; i++) {
			if(L[i] == '"' && L[i - 1] != '\\') {
				is_in_quotes = !is_in_quotes;
				continue;
			}
			if(is_in_quotes)
				ARMv4T.Assembler.Sections.Write(L.charCodeAt(i) & 0xFF, 'BYTE');
			if(L[i] == ',' && !is_in_quotes && D == 'ASCIZ')
				ARMv4T.Assembler.Sections.Write(0x00, 'BYTE');
		}
		if(D == 'ASCIZ')
			ARMv4T.Assembler.Sections.Write(0x00, 'BYTE');
*/
		L = '[' + L + ']';		
		var A = eval(L);
		for(var i in A) {
			for(var c in A[i])
				ARMv4T.Assembler.Sections.Write(A[i].charCodeAt(c) & 0xFF, 'BYTE');
			if(D.toUpperCase() == 'ASCIZ')
				ARMv4T.Assembler.Sections.Write(0x00, 'BYTE');
		}
	}
};