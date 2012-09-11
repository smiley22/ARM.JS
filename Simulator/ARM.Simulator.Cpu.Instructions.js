/***********************************************************
 *
 * ARM.Simulator.Cpu.Instructions.js
 *	Author:	 Torben Könke
 *	Date:    09.06.2012
 *
 * Implements a simple ARM CPU simulator which simulates
 *	the ARMv4T instruction architecture.
 *
 **********************************************************/

var ARM = ARM || {Simulator:{Cpu:{}}};

ARM.Simulator.Cpu.Instructions = {
	'bx': function(IW) {
		var Addr = this.GPR[IW & 0xF];
		if(Addr & 0x01)
			throw new Error('THUMB mode is not supported');
		this.SetPC(Addr);
		return 3;
	},

	'b_bl': function(IW) {
		var L = (IW >> 24) & 0x01;
		var O = IW & 0xFFFFFF;
		var Offset = ARM.Simulator.Cpu.Instructions.SignExtend
			(O << 2, 26, 32);
		if(L)
			this.GPR[14] = this.GPR[15] - 4;
		this.SetPC(this.GPR[15] + Offset);
		return 3;
	},

	'data': function(IW) {
		var Opcodes = {
			0: 'and',  1:'eor',  2:'sub',  3:'rsb',  4: 'add',  5:'adc',
			6: 'sbc',  7:'rsc',  8:'tst',  9:'teq',  10:'cmp', 11:'cmn',
			12:'orr', 13:'mov', 14:'bic', 15:'mvn'
		};
		var Opc = (IW >> 21) & 0xF;
		var S	= (IW >> 20) & 0x1;
		var I	= (IW >> 25) & 0x1;
		var Rn	= (IW >> 16) & 0xF;
		var Rd	= (IW >> 12) & 0xF;
		var Op2	= 0;
		var Cycles = Rd == 15 ? 2 : 1;
		if(I) {
			/* Operand 2 is rotated immediate */
			var Imm = IW & 0xFF;
			var Rot = ((IW >> 8) & 0xF) * 2;

			Op2 = ARM.Simulator.Cpu.Instructions.RotateRight
				(Imm, Rot);
		} else {
			/* Operand 2 is shifted register */
			var SOps = { 0:'LSL', 1:'LSR', 2:'ASR', 3:'ROR' };
			var Rm = IW & 0xF;
			var Sh = (IW >> 4) & 0xFF;
			var SOp = (Sh >> 1) & 0x03;
			var Amt = 0;
			var SCOut = 0; /* shifter carry-out */
			if(Sh & 0x01) {
				/* Shift by register */
				var Rs	= (Sh >> 4) & 0xF;
				Amt = this.GPR[Rs] & 0xF;
				Cycles = Cycles + 1;
			} else {
				/* Shift by unsigned 5-bit immediate */
				Amt = (Sh >> 3) & 0x1F;
			}
			/* Perform shift operation SOp by amount Amt on Rm */
			switch(SOps[SOp]) {
				case 'LSL':
					Op2 = this.GPR[Rm] << Amt;
					SCOut = Amt ? ((this.GPR[Rm] >> (32 - Amt)) & 0x01) :
						this.CPSR.C;
					break;
				case 'LSR':
					if(!Amt)
						Amt = 32;
					Op2 = this.GPR[Rm] >>> Amt;
					SCOut = (this.GPR[Rm] >>> (Amt - 1)) & 0x01;
					break;
				case 'ASR':
					if(!Amt)
						Amt = 32;
					/* >> is an arithmetic shift in Javascript */
					Op2 = this.GPR[Rm] >> Amt;
					SCOut = (this.GPR[Rm] >>> (Amt - 1)) & 0x01;
					break;
				case 'ROR':
					/* Amt == 0: RRX */
					if(!Amt) {
						Op2 = ((this.CPSR.C ? 1 : 0) << 31) | (this.GPR[Rm] >>> 1);
						SCOut = this.GPR[Rm] & 0x01;
					} else {
						Op2 = ARM.Simulator.Cpu.Instructions.RotateRight
							(this.GPR[Rm], Amt);
						SCOut = (this.GPR[Rm] >>> (Amt - 1)) & 0x01;
					}
					break;
			}
			/* set CPSR C flag to barrel-shifter carry-out */
			if(ARM.Simulator.Cpu.Instructions.IsLogical(Opcodes[Opc]) &&
				S == 1) {
				this.CPSR.C = SCOut;
			}
		}
		/* Dispatch */
		ARM.Simulator.Cpu.Instructions[ Opcodes[Opc] ].call(this,
			this.GPR[Rn], Op2, Rd, S, SCOut || null);
		return Cycles;
	},

	'and': function(Op1, Op2, Rd, S) {
		this.GPR[Rd] = (Op1 & Op2).toUint32();
		if(S) {
			this.CPSR.N = this.GPR[Rd] >>> 31;
			this.CPSR.Z = this.GPR[Rd] == 0;
		}
	},
	
	'eor': function(Op1, Op2, Rd, S) {
		this.GPR[Rd] = (Op1 ^ Op2).toUint32();
		if(S) {
			this.CPSR.N = this.GPR[Rd] >>> 31;
			this.CPSR.Z = this.GPR[Rd] == 0;
		}
	},

	'sub': function(Op1, Op2, Rd, S) {
		this.GPR[Rd] = (Op1 - Op2).toUint32();
		if(S) {
			this.CPSR.C = this.GPR[Rd] <= Op1;
			this.CPSR.V = ((Op1 ^ Op2) & (Op1 ^ this.GPR[Rd])).msb();
			this.CPSR.N = this.GPR[Rd] >>> 31;
			this.CPSR.Z = this.GPR[Rd] == 0;
		}
	},

	'rsb': function(Op1, Op2, Rd, S) {
		ARM.Simulator.Cpu.Instructions['sub'].call(this,
			Op2, Op1, Rd, S);
	},

	'add': function(Op1, Op2, Rd, S) {
		var R = Op1.toUint32() + Op2.toUint32();
		this.GPR[Rd] = R.toUint32();
		if(S) {
			this.CPSR.C = R > 0xFFFFFFFF;
			this.CPSR.V = (~(Op1 ^ Op2) & (Op1 ^ this.GPR[Rd])).msb();
			this.CPSR.N = this.GPR[Rd] >>> 31;
			this.CPSR.Z = this.GPR[Rd] == 0;
		}
	},

	'adc': function(Op1, Op2, Rd, S) {
		var R = Op1.toUint32() + Op2.toUint32() +
			(this.CPSR.C ? 1 : 0);
		this.GPR[Rd] = R.toUint32();
		if(S) {
			this.CPSR.C = R > 0xFFFFFFFF;
			this.CPSR.V = (~(Op1 ^ Op2) & (Op1 ^ this.GPR[Rd])).msb();
			this.CPSR.N = this.GPR[Rd] >>> 31;
			this.CPSR.Z = this.GPR[Rd] == 0;
		}
	},

	'sbc': function(Op1, Op2, Rd, S) {
		this.GPR[Rd] = (Op1 - Op2 - (this.CPSR.C ? 1 : 0))
			.toUint32();
		if(S) {
			this.CPSR.C = this.GPR[Rd] <= Op1; /* Fixme: Is this correct? */
			this.CPSR.V = ((Op1 ^ Op2) & (Op1 ^ this.GPR[Rd])).msb();
			this.CPSR.N = this.GPR[Rd] >>> 31;
			this.CPSR.Z = this.GPR[Rd] == 0;
		}
	},

	'rsc': function(Op1, Op2, Rd, S) {
		ARM.Simulator.Cpu.Instructions['sbc'].call(this,
			Op2, Op1, Rd, S);
	},

	'tst': function(Op1, Op2, Rd) {
		var R = (Op1 & Op2).toUint32();
		this.CPSR.N = R >>> 31;
		this.CPSR.Z = R == 0;
	},

	'teq': function(Op1, Op2, Rd) {
		var R = (Op1 ^ Op2).toUint32();
		this.CPSR.N = R >>> 31;
		this.CPSR.Z = R == 0;
	},

	'cmp': function(Op1, Op2, Rd) {
		var R = (Op1 - Op2).toUint32();
		this.CPSR.C = R <= Op1;
		this.CPSR.V = ((Op1 ^ Op2) & (Op1 ^ R)).msb();
		this.CPSR.N = R >>> 31;
		this.CPSR.Z = R == 0;
	},

	'cmn': function(Op1, Op2, Rd) {
		var R = Op1.toUint32() + Op2.toUint32();
		this.CPSR.C = R > 0xFFFFFFFF;
		this.CPSR.V = (~(Op1 ^ Op2) & (Op1 ^ R)).msb();
		this.CPSR.N = R >>> 31;
		this.CPSR.Z = R == 0;
	},

	'orr': function(Op1, Op2, Rd, S) {
		this.GPR[Rd] = (Op1 | Op2).toUint32();
		if(S) {
			this.CPSR.N = this.GPR[Rd] >>> 31;
			this.CPSR.Z = this.GPR[Rd] == 0;
		}
	},
	
	'mov': function(Op1, Op2, Rd, S) {
		this.GPR[Rd] = Op2.toUint32();
		if(S) {
			this.CPSR.N = this.GPR[Rd] >>> 31;
			this.CPSR.Z = this.GPR[Rd] == 0;
		}
	},

	'bic': function(Op1, Op2, Rd, S) {
		this.GPR[Rd] = (Op1 & (~Op2).toUint32()).toUint32();
		if(S) {
			this.CPSR.N = this.GPR[Rd] >>> 31;
			this.CPSR.Z = this.GPR[Rd] == 0;
		}
	},

	'mvn': function(Op1, Op2, Rd, S) {
		this.GPR[Rd] = (~Op2).toUint32();
		if(S) {
			this.CPSR.N = this.GPR[Rd] >>> 31;
			this.CPSR.Z = this.GPR[Rd] == 0;
		}
	},

	'psr': function(IW) {
		return ARM.Simulator.Cpu.Instructions[
			((IW >> 21) & 0x01) ? 'msr' : 'mrs'].call(this, IW);
	},

	'mrs': function(IW) {
		var P	= (IW >> 22) & 0x1;
		var Rd	= (IW >> 12) & 0xF;
		if(P) {
			if(!this.IsPrivileged())
				throw new Error('cannot access SPSR in user-mode');
			this.GPR[Rd] = this.Banked[this.CPSR.Mode].SPSR.toWord();
		} else
			this.GPR[Rd] = this.CPSR.toWord();		
		return 1;
	},

	'msr': function(IW) {
		var I = (IW >> 25) & 0x1;
		var P = (IW >> 22) & 0x1;
		var A = (IW >> 16) & 0x1; /* 1 = All, 0 = Flags only */
		var V = 0;

		if(I) {
			/* Operand is rotated immediate */
			var Imm = IW & 0xFF;
			var Rot = ((IW >> 8) & 0xF) * 2;
			V = ARM.Simulator.Cpu.Instructions.RotateRight
				(Imm, Rot);
		} else
			V = this.GPR[IW & 0xF];
		if(!this.IsPrivileged())
			A = 0;
		if(P) {
			if(!this.IsPrivileged())
				throw new Error('cannot access SPSR in user-mode');
			if(A) {
				this.Banked[this.CPSR.Mode].SPSR =
					ARM.Simulator.Cpu.Cpsr.fromWord(V);
			} else {
				var T = this.Banked[this.CPSR.Mode].SPSR.toWord();
				T &= ~0xF0000000;
				T |= (V & 0xF0000000);
				this.Banked[this.CPSR.Mode].SPSR =
					ARM.Simulator.Cpu.Cpsr.fromWord(T);
			}
		} else {
			if(A)
				this.CPSR = ARM.Simulator.Cpu.Cpsr.fromWord(V);
			else {
				var T = this.CPSR.toWord();
				T &= ~0xF0000000;
				T |= (V & 0xF0000000);
				this.CPSR = ARM.Simulator.Cpu.Cpsr.fromWord(T);
			}
		}
		return 1;
	},

	'mul_mla_mull_mlal': function(IW) {
		return ARM.Simulator.Cpu.Instructions[((IW >> 23) & 0x01) ?
			'mull_mlal' : 'mul_mla'].call(this, IW);
	},

	'mul_mla': function(IW) {
		var A  = (IW >> 21) & 0x1;
		var S  = (IW >> 20) & 0x1;
		var Rd = (IW >> 16) & 0xF;
		var Rn = (IW >> 12) & 0xF;
		var Rs = (IW >> 8) & 0xF;
		var Rm = IW & 0xF;
		var Cycles = (A ? 2 : 1) +
			ARM.Simulator.Cpu.Instructions.GetMultiplyCycles(Rs);
		this.GPR[Rd] = (this.GPR[Rm] * this.GPR[Rs]).toUint32();
		if(A) {
			this.GPR[Rd] =
				(this.GPR[Rd] + this.GPR[Rn]).toUint32();
		}
		if(S) {
			this.CPSR.N = this.GPR[Rd] >>> 31;
			this.CPSR.Z = this.GPR[Rd] == 0;
		}
		return Cycles;
	},

	'mull_mlal': function(IW) {
		var U	 = (IW >> 22) & 0x1;
		var A	 = (IW >> 21) & 0x1;
		var S	 = (IW >> 20) & 0x1;
		var RdHi = (IW >> 16) & 0xF;
		var RdLo = (IW >> 12) & 0xF;
		var Rs	 = (IW >> 8) & 0xF;
		var Rm	 = IW & 0xF;
		var Cycles = (A ? 3 : 2) +
			ARM.Simulator.Cpu.Instructions.GetMultiplyCycles(Rs);
		var Ret  = Math[(U ? 's' : 'u') + 'mul64'](this.GPR[Rs],
			this.GPR[Rm]);
		if(A) {
			Ret = Math.add64(Ret,
					{hi:this.GPR[RdHi], lo:this.GPR[RdLo]});
		}
		this.GPR[RdHi] = Ret.hi;
		this.GPR[RdLo] = Ret.lo;
		if(S) {
			this.CPSR.N = this.GPR[RdHi] >>> 31;
			this.CPSR.Z = this.GPR[RdHi] == 0 && this.GPR[RdLo] == 0;
		}
		return Cycles;
	},

	'ldr_str': function(IW) {
		var I	= (IW >> 25) & 0x1;
		var P	= (IW >> 24) & 0x1;
		var U	= (IW >> 23) & 0x1;
		var B	= (IW >> 22) & 0x1;
		var W	= (IW >> 21) & 0x1;
		var L	= (IW >> 20) & 0x1;
		var Rn	= (IW >> 16) & 0xF;
		var Rd	= (IW >> 12) & 0xF;
		var Ofs = 0;
		var Cycles = L ? ((Rd == 15) ? 5 : 3) : 2;
		if(I == 0) {
			/* Offset is unsigned 12-bit immediate */
			Ofs = IW & 0xFFF;
		} else {
			/* Offset is shifted register */
			var SOps = { 0:'LSL', 1:'LSR', 2:'ASR', 3:'ROR' };
			var Rm = IW & 0xF;
			var Sh = (IW >> 4) & 0xFF;
			var SOp = (Sh >> 1) & 0x03;
			var Amt = (Sh >> 3) & 0x1F;
			switch(SOps[SOp]) {
				case 'LSL':
					Ofs = this.GPR[Rm] << Amt;
					break;
				case 'LSR':
					Ofs = this.GPR[Rm] >>> ((Amt != 0) ? Amt : 32);
					break;
				case 'ASR':
					Ofs = this.GPR[Rm] >> ((Amt != 0) ? Amt : 32);
					break;
				case 'ROR':
					/* Amt == 0: RRX */
					if(!Amt)
						Ofs = ((this.CPSR.C ? 1 : 0) << 31) | (this.GPR[Rm] >>> 1);
					else
						Ofs = ARM.Simulator.Cpu.Instructions.RotateRight
							(this.GPR[Rm], Amt);
					break;
			}
		}
		if(!U)
			Ofs = (-1) * Ofs;
		var Addr = this.GPR[Rn] + (P ? Ofs : 0);
		try {
			if(L)
				this.GPR[Rd] = this.Memory.Read(Addr, B ? 'BYTE' : 'WORD');
			else
				this.Memory.Write(Addr, B ? 'BYTE' : 'WORD', this.GPR[Rd]);
		} catch(e) {
			/* accessing illegal address triggers a data-abort exception */
			if(e instanceof ARM.Simulator.Memory.BadAddressException) {
				this.TriggerException(this.Exceptions.Data);
				return false;
			}
			else {
				throw e;
			}
		}
		if(P == 0)
			Addr = Addr + Ofs;
		/* Writeback (always true if post-indexed) */
		if(W || P == 0)
			this.GPR[Rn] = Addr;
		return Cycles;
	},

	'ldrh_strh_ldrsb_ldrsh': function(IW) {
		var P	= (IW >> 24) & 0x1;
		var U	= (IW >> 23) & 0x1;
		var I	= (IW >> 22) & 0x1;
		var W	= (IW >> 21) & 0x1;
		var L	= (IW >> 20) & 0x1;
		var Rn	= (IW >> 16) & 0xF;
		var Rd	= (IW >> 12) & 0xF;
		var S	= (IW >> 6) & 0x1;
		var H	= (IW >> 5) & 0x1;
		var Ofs	= 0;
		var Cycles = L ? ((Rd == 15) ? 5 : 3) : 2;
		/* Offset is unsigned 8-bit immediate */
		if(I)
			Ofs = ((IW >> 4) & 0xF0) | (IW & 0xF);
		/* Offset is register content */
		else
			Ofs = this.GPR[IW & 0xF];
		if(!U)
			Ofs = (-1) * Ofs;
		var Addr = this.GPR[Rn] + (P ? Ofs : 0);
		try {
			if(L)
				this.GPR[Rd] = this.Memory.Read(Addr, H ? 'HWORD' : 'BYTE');
			else
				this.Memory.Write(Addr, H ? 'HWORD' : 'BYTE', this.GPR[Rd]);
		} catch(e) {
			/* accessing illegal address triggers a data-abort exception */
			if(e instanceof ARM.Simulator.Memory.BadAddressException) {
				this.TriggerException(this.Exceptions.Data);
				return false;
			}
			else {
				throw e;
			}
		}
		/* Sign-extend */
		if(S && L) {
			this.GPR[Rd] = ARM.Simulator.Cpu.Instructions.SignExtend(
				this.GPR[Rd], H ? 16 : 8, 32);
		}
		if(P == 0)
			Addr = Addr + Ofs;
		/* Writeback (always true if post-indexed) */
		if(W || P == 0)
			this.GPR[Rn] = Addr;
		return Cycles;
	},

	'ldm_stm': function(IW) {
		var P = (IW >> 24) & 0x1;
		var U = (IW >> 23) & 0x1;
		var S = (IW >> 22) & 0x1;
		var W = (IW >> 21) & 0x1;
		var L = (IW >> 20) & 0x1;
		var Rn = (IW >> 16) & 0xF;
		var RList = IW & 0xFFFF;
		var Cycles = L ? ((RList & 0x8000) ? 4 : 2) : 1;
		/* use banked user registers insted of current mode's */
		var User = false;
		if(S) {
			if(!this.IsPrivileged())
				throw new Error('ldm/stm with s = 1 but not privileged');
			if(L && (RList & 0x8000))
				this.CPSR = this.Banked[this.CPSR.Mode].SPSR;
			else
				User = true;
		}
		var Offset = U ? 0 :
			(-4 * ARM.Simulator.Cpu.Instructions.CountBits(RList));
		/* flip P bit if Offset != 0 (see Figure 4-19 to 4-22, Section 4.11.2) */
		if(Offset)
			P = P ? 0 : 1;
		var Addr = this.GPR[Rn] + Offset;
		for(var i = 0; i < 16; i++) {
			if(!(RList & (1 << i)))
				continue;
			Cycles = Cycles + 1;
			if(P)
				Addr = Addr + 4;
			try {
				/* load */
				if(L) {
					var C = this.Memory.Read(Addr, 'WORD');
					if(User && i > 7 && i < 15)
						this.Banked[this.Modes.User][i] = C;
					else
						this.GPR[i] = C;
				} else {
					/* store */
					if(User && i > 7 && i < 15) {
						this.Memory.Write(Addr, 'WORD',
							this.Banked[this.Modes.User][i]);
					} else
						this.Memory.Write(Addr, 'WORD', this.GPR[i]);
				}
			} catch(e) {
				/* accessing illegal address triggers a data-abort exception */
				if(e instanceof ARM.Simulator.Memory.BadAddressException) {
					this.TriggerException(this.Exceptions.Data);
					return false;
				}
				else
					throw e;
			}
			if(!P)
				Addr = Addr + 4;
		}
		if(W)
			this.GPR[Rn] = Addr + Offset;
		return Cycles;
	},

	'swp': function(IW) {
		var B  = (IW >> 22) & 0x1;
		var Rn = (IW >> 16) & 0xF;
		var Rd = (IW >> 12) & 0xF;
		var Rm = IW & 0xF;
		try {
			var C = this.Memory.Read(this.GPR[Rn], B ? 'BYTE' : 'WORD');
			this.Memory.Write(this.GPR[Rn], B ? 'BYTE' : 'WORD', this.GPR[Rm]);
			this.GPR[Rd] = C;
		} catch(e) {
			if(e instanceof ARM.Simulator.Memory.BadAddressException) {
				this.TriggerException(this.Exception.Data);
				return false;
			}
			else
				throw e;
		}
		return 4;
	},

	'swi': function(IW) {
		if(this.IsIRQEnabled() == true)
			this.TriggerException(this.Exception.Software);
		return 3;
	},

	'cdp': function(IW) {
		var Opc = (IW >> 20) & 0xF;
		var CRn = (IW >> 16) & 0xF;
		var CRd = (IW >> 12) & 0xF;
		var CNo = (IW >>  8) & 0xF;
		var CP  = (IW >>  5) & 0x7;
		var CRm = IW & 0xF;
		throw new Error('cdp instruction not implemented');
		/* FIXME: account for cycles spent in the coprocessor busy-wait loop */
		return 1;
	},

	'ldc_stc': function(IW) {
		var P	= (IW >> 24) & 0x1;
		var U	= (IW >> 23) & 0x1;
		var N	= (IW >> 22) & 0x1;
		var W	= (IW >> 21) & 0x1;
		var L	= (IW >> 20) & 0x1;
		var Rn	= (IW >> 16) & 0xF;
		var CRd = (IW >> 12) & 0xF;
		var CNo = (IW >>  8) & 0xF;
		var Ofs = IW & 0xFF;
		throw new Error('ldc/stc instruction not implemented');
		/* FIXME: account for cycles spent in the coprocessor busy-wait loop */
		return 2;
	},

	'mrc_mcr': function(IW) {
		var Opc	= (IW >> 21) & 0x7;
		var L	= (IW >> 20) & 0x1;
		var CRn = (IW >> 16) & 0xF;
		var Rd	= (IW >> 12) & 0xF;
		var CNo	= (IW >> 8) & 0xF;
		var CP	= (IW >> 5) & 0x7;
		var CRm	= IW & 0xF;
		throw new Error('mrc/mcr instruction not implemented');
		/* FIXME: account for cycles spent in the coprocessor busy-wait loop */
		return 2;
	},

	'undefined': function(IW) {
		this.TriggerException(this.Exception.Undefined);
		return 3;
	}
};

/*
 * ARM.Simulator.Cpu.Instructions.SignExtend
 *	Performs sign extension on an integer when it is transformed
 *	into a larger datatype.
 *
 * @V
 *	Value to operate on
 * @F
 *	Size of value V in bits
 * @T
 *	Size value should be transformed to in bits
 *
 * @Return
 *	Returns a new sign-extended value of T-bits Size
 */
ARM.Simulator.Cpu.Instructions.SignExtend = function(V, F, T) {
	var msb = F - 1;
	if(V & (1 << msb)) {
		for(var i = 1 + msb; i < T; i++)
			V |= (1 << i);
	}
	return V;
}

/*
 * ARM.Simulator.Cpu.Instructions.RotateRight
 *	Performs a bitwise right rotation on a value by
 *	the specified amount.
 *
 * @V
 *	Value to operate on
 * @N
 *	Number of bits to right rotate value
 *
 * @Return
 *	Returns value right-rotated by N bits
 */
ARM.Simulator.Cpu.Instructions.RotateRight = function(V, N) {
	for(var i = 0; i < N; i++)
		V = (V >>> 1) | ((V & 0x01) << 31);
	return V;
}

/*
 * ARM.Simulator.Cpu.Instructions.IsLogical
 *	Returns true if operation is logical (as opposed to
 *	arithmetic)
 *
 * @Opcode
 *	Operation code
 *
 * @Return
 *	Returns true if operation is a logical operation
 */
ARM.Simulator.Cpu.Instructions.IsLogical = function(Opcode) {
	var A = ['and', 'eor', 'tst', 'teq', 'orr', 'mov',
			 'bic', 'mvn'];
	return (A.indexOf(Opcode.toLowerCase()) >= 0);
}

/*
 * ARM.Simulator.Cpu.Instructions.CountBits
 *	Returns the number of set bits in a 32-bit value.
 *
 * @V
 *	A 32-bit value
 *
 * @Return
 *	Returns the number of set bits in V
 */
ARM.Simulator.Cpu.Instructions.CountBits = function(V) {
	var C = 0;
	for(var i = 0; i < 32; i++) {
		if(V & (1 << i))
			C++;
	}
	return C;
}

/*
 * ARM.Simulator.Cpu.Instructions.GetMultiplyCycles
 *	Returns the number of 8 bit multiplier array cycles
 *	required to complete a multiply operation on the
 *	ARM7 processor.
 *
 * @M
 *	Multiplier operand specified by Rs in mul(l)
 *	instructions
 *
 * @Return
 *	Returns the number of required clock cycles
 */
ARM.Simulator.Cpu.Instructions.GetMultiplyCycles = function(V) {
	var U = V.toUint32();
	if(U < 0xFF)
		return 1;
	if(U < 0xFFFF)
		return 2;
	if(U < 0xFFFFFF)
		return 3;
	return 4;
}

/*
 * Number.prototype.toUint32
 *	Returns an unsigned 32-bit Javascript number.
 *
 *	Javascript stores all numbers as double values. Using
 *	bitwise operations is achieved by internally converting back
 *	and forth between double and integer representations. Also
 *	all bitwise operations but >>> will return signed numbers.
 *
 *	var A = 0x80000000		(Positive value)
 *	var B = A & 0xFFFFFFFF	(Negative value, not what we want)
 *
 * @x
 *	value to convert
 *
 * @Return
 *	Returns an unsigned 32-bit Javascript number
 */
Number.prototype.toUint32 = function() {
	return this >>> 0;
}

/*
 * Number.prototype.toInt32
 *	Returns a signed 32-bit Javascript number
 *	(see comment above).
 *
 * @x
 *	value to convert
 *
 * @Return
 *	Returns an signed 32-bit Javascript number
 */
Number.prototype.toInt32 = function() {
	return this >> 0;
}

/*
 * Number.prototype.msb
 *
 * @Return
 *	Returns the most significant bit
 */
Number.prototype.msb = function() {
	return this >>> 31;
}

/*
 * Math.add64
 *	Adds two 64-bit integers.
 *
 * @a
 *	object containing two 32-bit integers making
 *	up the low and high parts of the first 64-bit value
 *
 *	@b
 *	object containing two 32-bit integers making
 *	up the low and high parts of the second 64-bit value
 *
 * @Return
 *	The sum of a and b
 */
Math.add64 = function(a, b) {
	var rh = a.hi + b.hi, rl = a.lo + b.lo;
	if(rl > 0xffffffff)
		rh = rh + 1;
	return {hi:rh.toUint32(), lo:rl.toUint32()};
}

/*
 * Math.umul64
 *	Multiplies two unsigned 32-bit values and returns
 *	the result as a 64-bit value.
 *
 * @a
 *	unsigned 32-bit multiplicand.
 *
 *	@b
 *	unsigned 32-bit multiplier.
 *
 * @Return
 *	The product of a and b as an unsigned 64-bit integer.
 */
Math.umul64 = function(a, b) {
	var	ah	 = (a >>> 16),		al	 = a & 0xffff,
		bh	 = (b >>> 16),		bl	 = b & 0xffff,
		rh	 = (ah * bh),		rl	 = (al * bl),
		rm1  = ah * bl,			rm2	 = al * bh,
		rm1h = rm1 >>> 16,		rm2h = rm2 >>> 16,
		rm1l = rm1 & 0xffff,	rm2l = rm2 & 0xffff,
		rmh	 = rm1h + rm2h,		rml	 = rm1l + rm2l;
	if(rl > (rl + (rml << 16)).toUint32())
		rmh = rmh + 1;
	rl = (rl + (rml << 16)).toUint32();
	rh = rh + rmh;
	if(rml & 0xffff0000)
		rh = rh + 1;
	return {hi: rh, lo: rl};
}

/*
 * Math.smul64
 *	Multiplies two signed 32-bit values and returns
 *	the result as a 64-bit value.
 *
 * @a
 *	signed 32-bit multiplicand.
 *
 *	@b
 *	signed 32-bit multiplier.
 *
 * @Return
 *	The product of a and b as a signed 64-bit integer.
 */
Math.smul64 = function(a, b) {
	var neg = ((a & 0x80000000) ^ (b & 0x80000000)) ? 1 : 0;
	var _hi, _lo;
	var _a = (a & 0x80000000) ? (1 + (~a)).toUint32() : a.toUint32();
	var _b = (b & 0x80000000) ? (1 + (~b)).toUint32() : b.toUint32();
	var _c = Math.umul64(_a, _b);
	if(neg) {
		var carry = 0;
		_c.lo = (~_c.lo).toUint32();
		if(_c.lo > (_c.lo + 1).toUint32())
			carry = 1;
		_c.lo = (_c.lo + 1).toUint32();
		_c.hi = ((~_c.hi).toUint32() + carry).toUint32();
	}
	return {hi:_c.hi, lo:_c.lo};
}
