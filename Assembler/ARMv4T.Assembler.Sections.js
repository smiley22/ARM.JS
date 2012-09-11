/***********************************************************
 *
 * ARMv4T.Assembler.Sections.js
 *	Author:	 Torben Könke
 *	Date:    30.05.2012
 *
 * Implements methods for managing text and data sections.
 *
 **********************************************************/

var ARMv4T = ARMv4T || {Assembler:{}};

ARMv4T.Assembler.Sections = {
	'.TEXT': {
		Base:	0x00000000,
		Size:	0, /* section size is calculated in pass 0 */
		Pos:	0, /* pos is the current writing position in the data buffer */
		Data:	new ArrayBuffer(32768)
	},

	'.DATA': {
		Base:	0x40000000,
		Size:	0,
		Pos:	0,
		Data:	new ArrayBuffer(8192)
	},

	/*
	 * ARMv4T.Assembler.Sections.Clear
	 *	Resets all sections.
	 */
	Clear: function() {
		var A = ['.TEXT', '.DATA'];
		for(var i in A) {
			ARMv4T.Assembler.Sections[A[i]].Size = 0;
			ARMv4T.Assembler.Sections[A[i]].Pos = 0;
		}
	},

	/*
	 * ARMv4T.Assembler.Sections.Write
	 *	Writes data to section. Can only be called during pass 1.
	 *
	 *	@Value
	 *	 Data value to be written
	 *
	 *	@Type
	 *	 Data type of value (see below).
	 *
	 * @Section
	 *	 Optional. Section to be written into. If omitted, the
	 *	 currently selected section will be written into.
	 *
	 *	@Return
	 *	 Nothing. If an error occurs, an exception is thrown.
	 */
	Write: function(Value, Type, Section) {
		var Sizes = {'BYTE':1,'HWORD':2,'WORD':4,'2BYTE':2,'4BYTE':4};
		var S = Section || ARMv4T.Assembler.Section;
		var View = null;

		if(ARMv4T.Assembler.Pass != 1)
			throw new Error('sections can only be written in pass 1');
		if(!ARMv4T.Assembler.Sections[S].Size)
			throw new Error('size of section ' + S + ' is zero');

		Type = Type.toUpperCase();
		switch(Type) {
			case 'BYTE':
				View = new Uint8Array(ARMv4T.Assembler.Sections[S].Data);
			break;
			case 'HWORD':
			case '2BYTE':
				View = new Uint16Array(ARMv4T.Assembler.Sections[S].Data);
			break;
			case 'WORD':
			case '4BYTE':
				View = new Uint32Array(ARMv4T.Assembler.Sections[S].Data);
			break;
			default:
				throw new Error('invalid data type ' + Type);
		}
		var Index = ARMv4T.Assembler.Sections[S].Pos;
		if((Index % Sizes[Type]) != 0)
			throw new Error('trying to write ' + Type + ' value at un-aligned offset ' + Index);
		Index = Index / Sizes[Type];

		View[ Index ] = Value;
		ARMv4T.Assembler.Sections[S].Pos += Sizes[Type];
	},

	/*
	 * ARMv4T.Assembler.Sections.Dump
	 *	Dumps the contents of the passes section. Helper method
	 *	for debugging.
	 *
	 *	@Section
	 *	 Name of the section to be dumped to console.
	 */
	Dump: function(Section) {
		var S = ARMv4T.Assembler.Sections[Section];
		if(!S)
			throw new Error('Section ' + Section + ' does not exist');
		console.info('---------Section ' + Section + ' start---------');
		console.info('Base Address: 0x' + S.Base.toString(16));
		console.info('Size: ' + S.Size);
		console.info('Pos: ' + S.Pos);
		console.info('Contents:');
		var View = new Uint8Array(S.Data);
		var B = [];
		for(var i = 0; i < S.Size; i++)
			B.push(View[i]);
		console.info(B);
		console.info('----------Section ' + Section + ' end---------');
	}
};
