/***********************************************************
 *
 * ARM.Simulator.Loader.js
 *	Author:	 Torben Könke
 *	Date:    12.06.2012
 *
 * Implements the loader component of a simple ARM CPU
 *	simulator which simulates the ARMv4T instruction
 *	architecture. The loader is responsible for copying
 *	object data into the designated memory regions and
 *	preparing an image for execution.
 *
 **********************************************************/

var ARM = ARM || {Simulator:{}};

ARM.Simulator.Loader = {
	
	LoadImage: function(Mem, Img) {
		/* Map sections into memory */
		for(var i in Img.Sections) {
			if(i[0] != '.')
				continue;
			var S  = Img.Sections[i];
			var U8 = new Uint8Array(S.Data); 

			// Write S.Data to S.Base (Length of S.Size)
			for(var c = 0; c < S.Size; c++)
				Mem.Write(S.Base + c, 'BYTE', U8[c]);
		}
	},
		
	LoadELF: function(Mem, Data) {
		var R = new ARM.Simulator.Loader.BinaryReader(Data);
		
		var e_header = this.ReadELFHeader(R);
		/* read entries in program header table */
		R.Seek(e_header.e_phoff);
		for(var i = 0; i < e_header.e_phnum; i++) {
			var p_header = R.ReadStruct(this.Elf.p_header);
			/* skip if it's not a loadable segment */
			if(p_header.p_type != this.Elf.PTLoad)
				continue;
			this.LoadELFSegment(p_header, Mem, Data);
		}
	},

	ReadELFHeader: function(R) {
		/* read machine-independent header */
		var e_ident = R.ReadStruct(this.Elf.e_ident);
		var e_magic = [0x7f, 0x45, 0x4C, 0x46];
		for(var i = 0; i < 4; i++) {
			if(e_ident.ei_magic[i] != e_magic[i])
				throw new Error('not a valid ELF file');
		}
		if(e_ident.ei_class != this.Elf.ElfClass32)
			throw new Error('only 32-bit ELF files are supported');
		if(e_ident.ei_data != this.Elf.ElfData2Lsb)
			throw new Error('wrong endianness, expected little endian');
		if(e_ident.ei_version != this.Elf.EvCurrent)
			throw new Error('wrong elf version, expected ' + this.Elf.EvCurrent);
		
		/* verify actual header data */
		var e_header = R.ReadStruct(this.Elf.e_header);
		if(e_header.e_type != this.Elf.ETExec)
			throw new Error('elf file is not of type executable');
		if(e_header.e_machine != this.Elf.EMArm)
			throw new Error('elf is not an arm executable');
		if(e_header.e_version != this.Elf.EvCurrent)
			throw new Error('wrong elf version, expected ' + this.Elf.EvCurrent);
		var AbiVersion = e_header.e_flags & this.Elf.EfArmEAbiMask;
		if(AbiVersion != this.Elf.EfArmAbiVersion)
			throw new Error('wrong arm abi version, expected ' +
				this.Elf.EfArmAbiVersion);
		if(e_header.e_flags & this.Elf.EfArmBe8)
			throw new Error('elf contains BE-8 code which is not supported');
		return e_header;
	},

	LoadELFSegment: function(p_header, Mem, Data) {
		/* copy p_filesz bytes from Data[ p_offset ] to Mem[ p_vaddr ] */
		for(var i = 0; i < p_header.p_filesz; i++)
			Mem.Write(p_header.p_vaddr + i, 'BYTE', Data[ p_header.p_offset + i ]);
		/* FIXME: what about p_align? */
	},

	Elf: {
		e_ident: [
			['ei_magic',	4, 'u8'],
			['ei_class',	1, 'u8'],
			['ei_data',		1, 'u8'],
			['ei_version',	1, 'u8'],
			['ei_pad',		9, 'u8']
		],

		ElfClassNone:	0x00,
		ElfClass32:		0x01,
		ElfClass64:		0x02,
		ElfDataNone:	0x00,
		ElfData2Lsb:	0x01,
		ElfData2Msb:	0x02,
		EvNone:			0x00,
		EvCurrent:		0x01,
		EfArmEAbiMask:	0xFF000000,
		EfArmAbiVersion:0x05000000,
		EfArmBe8:		0x00800000,

		e_header: [
			['e_type',		2, 'u16'],
			['e_machine',	2, 'u16'],
			['e_version',	4, 'u32'],
			['e_entry',		4, 'u32'],
			['e_phoff',		4, 'u32'],
			['e_shoff',		4, 'u32'],
			['e_flags',		4, 'u32'],
			['e_ehsize',	2, 'u16'],
			['e_phentsize',	2, 'u16'],
			['e_phnum',		2, 'u16'],
			['e_shentsize',	2, 'u16'],
			['e_shnum',		2, 'u16'],
			['e_shstrndx',	2, 'u16']

		],

		ETNone:			0x00,
		ETRel:			0x01,
		ETExec:			0x02,
		ETDyn:			0x03,
		ETCore:			0x04,
		ETLoproc:		0xff00,
		ETHiproc:		0xffff,
		
		EMM32:			0x01,
		EMSparc:		0x02,
		EM386:			0x03,
		EM68K:			0x04,
		EM88K:			0x05,
		EM860:			0x07,
		EMMips:			0x08,
		EMMipsRs4Be:	0x10,
		EMArm:			0x28,

		p_header: [
			['p_type',		4, 'u32'],
			['p_offset',	4, 'u32'],
			['p_vaddr',		4, 'u32'],
			['p_paddr',		4, 'u32'],
			['p_filesz',	4, 'u32'],
			['p_memsz',		4, 'u32'],
			['p_flags',		4, 'u32'],
			['p_align',		4, 'u32']
		],

		PTNull:			0x00,
		PTLoad:			0x01,
		PTDynamic:		0x02,
		PTInterp:		0x03,
		PTNote:			0x04,
		PTShlib:		0x05,
		PTPhdr:			0x06,
		PTLoproc:		0x70000000,
		PTHiproc:		0x7fffffff,

		PFX:			0x01,
		PFW:			0x02,
		PFR:			0x04,
		PFMaskproc:		0xf0000000
	}

}
