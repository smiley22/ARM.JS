/***********************************************************
 *
 * ARMv4T.Assembler.Litpools.js
 *	Author:	 Torben Könke
 *	Date:    02.06.2012
 *
 * Implements methods for creating and maintaining literal
 * pools.
 *
 **********************************************************/

var ARMv4T = ARMv4T || {Assembler:{}};

ARMv4T.Assembler.Litpools = {
	Pools: [],

	/*
	 * ARMv4T.Assembler.Litpools.Create
	 *	Creates a new literal pool at the specified offset
	 *	in the .text segment.
	 *
	 *	@Base
	 *	 Offset into .text segment where the new litpool will
	 *	 be situated.
	 */
	Create: function(Base) {
		ARMv4T.Assembler.Litpools.Pools.push({
			'Base': Base,
			'Size': 0,
			'Literals': {}
		});
	},

	/*
	 * ARMv4T.Assembler.Litpools.Put
	 *	Puts a 32-bit constant into the literal pool.
	 *
	 *	@Value
	 *	 Value that will be stored inside the literal pool.
	 *
	 *	@Return
	 *	 Returns the byte offset at which the value is stored
	 */
	Put: function(Value) {
		if(ARMv4T.Assembler.Pass != 1)
			throw new Error('Literal pools can only be written in pass 1');
		var P = ARMv4T.Assembler.Litpools.Pools[0];
    // If the value already been stored in the literal pool, just return
    // the offset.
		if(P.Literals[Value])
      return P.Literals[Value];
		
    var Offset	= P.Base + P.Size;
		var View	= new Uint32Array(ARMv4T.Assembler.Sections['.TEXT'].Data);
		var Index	= Offset / 4;

		View[Index]			= Value;
		P.Literals[Value]	= Offset;
		P.Size				= P.Size + 4;

//		console.info('value ' + Value + ' (0x' + Value.toString(16) + ') written to literal pool at offset ' + Offset);

    // Litpool is part of the .TEXT section.
    ARMv4T.Assembler.Sections['.TEXT'].Size += 4;
		return Offset;
	},

	/*
	 * ARMv4T.Assembler.Litpools.Get
	 *	Retrieves the offset of a 32-bit constant stored in
	 *	the literal pool.
	 *
	 *	@Value
	 *	 Value whose offset should be looked up
	 *
	 *	@Return
	 *	 Returns the byte offset at which the value is stored.
	 *	 If the value can not be found inside the literal pool,
	 *	 an exception is thrown.
	 */
	Get: function(Value) {
		var P = ARMv4T.Assembler.Litpools.Pools[0];
		if(typeof(P.Literals[Value]) == 'undefined')
			throw new Error('Literal not found in literal pool');
		return P.Literals[Value];
	},

	Clear: function() {
		ARMv4T.Assembler.Litpools.Pools = [];
	},


	/*
	 * ARMv4T.Assembler.Litpools.Dump
	 *	Dumps the content of the literal pool. Helper function for
	 *	debugging.
	 */
	Dump: function() {
		var P = ARMv4T.Assembler.Litpools.Pools[0];
		console.info('---------Literal pool start---------');
		console.info('Base Address: 0x' + P.Base.toString(16));
		console.info('Size: ' + P.Size);
		console.info('Contents:');

		var View	= new Uint32Array(ARMv4T.Assembler.Sections['.TEXT'].Data);
		var Words	= [];
		var Offset	= P.Base / 4;
		for(var i = 0; i < (P.Size / 4); i++)
			Words.push(View[Offset + i]);

		console.info(Words);
		console.info('---------Literal pool end---------');
	}
};
