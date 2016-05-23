/***********************************************************
 *
 * ARMv4T.Assembler.Symbols.js
 *	Author:	 Torben Könke
 *	Date:    30.05.2012
 *
 * Implements methods for creating and maintaining the
 * assembler's symbol table.
 *
 **********************************************************/

var ARMv4T = ARMv4T || {Assembler:{}};

ARMv4T.Assembler.Symbols = {
	Symbols: {},

	/*
	 * ARMv4T.Assembler.Symbols.Add
	 *	Adds a symbol to the symbol table. Must only be called
	 *	during pass 0.
	 *
	 *	@O
	 *	 Object with following fields:
	 *		- Name		(mandatory)
	 *		- Value		(mandatory)
	 *		- Section	(mandatory for symbols of type 'Label')
	 *		- Type		(mandatory)
	 *		  'Label' for Label
	 *		  'Equ' for Equ
	 */
	Add: function(O) {
		if(ARMv4T.Assembler.Pass != 0)
			throw new Error('Symbols can only be defined in pass 0');
		if(ARMv4T.Assembler.Symbols.Symbols[O.Name])
			throw new Error('Symbol re-definition');
		if(O.Type == 'Label' && !O.Section)
			throw new Error('No section specified for label definition');

		ARMv4T.Assembler.Symbols.Symbols[O.Name] = {
			'Value':	O.Value,
			'Type':		O.Type,
			'Section':	O.Section
		};
	},

	/*
	 * ARMv4T.Assembler.Symbols.Get
	 *	Retrieves value of a symbol from the symbol table. Must only
	 *	be called during pass 1.
	 *
	 *	@Symbol
	 *	 Name of the symbol to retrieve
	 */
	Get: function(Symbol) {
		if(ARMv4T.Assembler.Pass != 1)
			throw new Error('Symbols can only be retrieved in pass 1');
		var R = ARMv4T.Assembler.Symbols.Symbols[Symbol];
		if(!R)
			throw new Error('Symbol ' + Symbol + ' not defined');
		if(R.Type == 'Label') {
			/* Return Defined symbol + Base address of section */
			var S = ARMv4T.Assembler.Sections[R.Section];
			return S.Base + R.Value;
		} else {
			return R.Value;
		}
	},

	/*
	 * ARMv4T.Assembler.Symbols.Clear
	 *	Removes all entries from the symbol table.
	 *
	 */
	Clear: function() {
		ARMv4T.Assembler.Symbols.Symbols = {};
	},

	/*
	 * ARMv4T.Assembler.Symbols.Dump
	 *	Dumps the symbol table to the console. Helper method for
	 *	debugging.
	 *
	 */
	Dump: function() {
		console.info('---------Symbol table start---------');
		for(var e in ARMv4T.Assembler.Symbols.Symbols) {
			var O = ARMv4T.Assembler.Symbols.Symbols[e];
			var S = e + '\t[Type:' + O.Type;
			if(O.Type == 'Label')
				S = S + ', Section:' + O.Section;
			S = S + '] -> ' + O.Value;
			console.info(S);
		}
		console.info('----------Symbol table end---------');
	}
};
