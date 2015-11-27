/***********************************************************
 *
 * ARM.Simulator.Cpu.js
 *	Author:	 Torben Könke
 *	Date:    09.06.2012
 *
 * Implements a simple ARM CPU simulator which simulates
 *	the ARMv4T instruction architecture.
 *
 **********************************************************/

var ARM = ARM || {Simulator:{}};

ARM.Simulator.Cpu = function(O) {
	/*
	 * ARM.Simulator.Cpu.Constructor
	 *	Initializes a new Cpu Object.
	 *
	 * @O
	 *  Object providing the following properties:
	 *	 "Clockrate":	The frequency at which the CPU is running,
	 *					in MHz
	 *	 "Memory":		An object of type ARM.Simulator.Memory
	 *
	 */
	function Cpu(O) {
		/* Save clockrate as Hz */
		this.Clockrate	= O.Clockrate * 1000000;
		this.Memory		= O.Memory;
		for(var i = 0; i < this.GPR.length; i++)
			this.GPR[i] = 0;
//		this.TriggerException(this.Exceptions.Reset);
	}

	/*
	 * ARM.Simulator.Cpu.SwitchMode
	 *	Switches CPU to the designated mode and enables
	 *	access to banked registers.
	 *
	 *	@newMode
	 *	 A mode value of the ARM.Simulator.Cpu.Modes enumeration
	 */
	this.SwitchMode = function(newMode) {
		var isValidMode = false;
		for(var m in this.Modes) {
			if(this.Modes[m] === newMode) {
				isValidMode = true;
				break;
			}
		}
		if(!isValidMode)
			throw new TypeError('Invalid processor mode');
		var curBank = this.CPSR.Mode == this.Modes.System ?
			this.Modes.User : this.CPSR.Mode;
		var newBank = newMode == this.Modes.System ?
			this.Modes.User : newMode;
		if(curBank != newBank) {
			/* save current register and load banked registers */
			var O = this.Banked[curBank];
			var N = this.Banked[newBank];
			for(var r in N) {
				if(r == 'SPSR') {
					N[r] = this.CPSR;
					continue;
				}
				if(typeof O[r] != 'undefined')
					O[r] = this.GPR[r];
				this.GPR[r] = N[r];
			}
		}
		/* set CPSR mode */
		this.CPSR.Mode = newMode;
	}

	this.GPR		= new Array(0x10);
	this.CPSR		= new ARM.Simulator.Cpu.Cpsr();
	this.Cycles		= 0;
	this.InstCount	= 0;

	/* set when an exception is raised during the execution of
		an instruction */
	this.PendingException = false;

	/*
	 * ARM.Simulator.Cpu.Modes
	 *	Different modes supported by the CPU as outlined in the
	 *  ARM7-TDMI Technical Instruction Reference
	 *	2.5 Operating modes
	 */
	this.Modes = {
		User: 		0x10,
		FIQ:		0x11,
		IRQ:		0x12,
		Supervisor:	0x13,
		Abort:		0x17,
		Undefined:	0x1B,
		System:		0x1F
	}
			
	this.Banked = {
		0x10:	{ 8:0, 9:0, 10:0, 11:0, 12:0, 13:0, 14:0 },
		0x11:	{ 8:0, 9:0, 10:0, 11:0, 12:0, 13:0, 14:0, SPSR:0 },
		0x12:	{ 13:0, 14:0, SPSR: 0 },
		0x13:	{ 13:0, 14:0, SPSR: 0 },
		0x17:	{ 13:0, 14:0, SPSR: 0 },
		0x1B:	{ 13:0, 14:0, SPSR: 0 }
		/* System and User share banked registers */
	}

	/*
	 * ARM.Simulator.Cpu.Exceptions
	 *	Possible exceptions that can occur as outlined in the 
	 *  ARM7-TDMI Technical Instruction Reference
	 *	Section 2.8 Exceptions
	 */
	this.Exceptions = {
		Reset: {
			Vector:		0x00,
			Priority:	0x10,
			IRQ:		true,
			FIQ:		true,
			Mode:		this.Modes.Supervisor
		},

		Undefined: {
			Vector:		0x04,
			Priority:	0x00,
			IRQ:		true,
			Mode:		this.Modes.Undefined
		},

		Software: {
			Vector:		0x08,
			Priority:	0x00,
			IRQ:		true,
			Mode:		this.Modes.Supervisor
		},

		Prefetch: {
			Vector:		0x0C,
			Priority:	0x01,
			IRQ:		true,
			Mode:		this.Modes.Abort
		},

		Data: {
			Vector:		0x10,
			Priority:	0x08,
			IRQ:		true,
			Mode:		this.Modes.Abort
		},

		IRQ: {
			Vector:		0x18,
			Priority:	0x02,
			IRQ:		true,
			Mode:		this.Modes.IRQ
		},

		FIQ: {
			Vector:		0x1C,
			Priority:	0x04,
			IRQ:		true,
			FIQ:		true,
			Mode:		this.Modes.FIQ
		}
	}

	/*
	 * ARM.Simulator.Cpu.TriggerException
	 *	Systematically raises an exception. When an exception occurs
	 *	the following steps must be taken:
	 *
	 *	 1. Switch Cpu to corresponding mode
	 *	 2. Disable IRQ and possibly FIQ
	 *	 3. Force Cpu State to ARM (as opposed to Thumb)
	 *	 4. Set the PC to point at the exception vector
	 *
	 *	@e
	 *	 One of the ARM.Simulator.Cpu.Exceptions exception
	 *	 that will be raised. 
	 */
	this.TriggerException = function(e) {
		this.SwitchMode(e.Mode);
		this.EnableIRQ(!e.IRQ);
		if(typeof e.FIQ != 'undefined')
			this.EnableFIQ(!e.FIQ);
		this.SetState(this.States.ARM);
		this.SetPC(e.Vector);
		this.PendingException = true;
	}

	this.States = {
		ARM:	0x00,
		Thumb:	0x01
	}
	
	this.EnableIRQ = function(Enable) {
		this.CPSR.I = Enable;
	}
	
	this.EnableFIQ = function(Enable) {
		this.CPSR.F = Enable;
	}

	this.IsIRQEnabled = function() {
		return this.CPSR.I == true;
	}

	this.IsFIQEnabled = function() {
		return this.CPSR.F == true;
	}
	
	this.SetPC = function(PC) {
		if(PC % 4)
			throw new Error('Unaligned memory address for PC (0x' +
				PC.toString(16) + ')');
		this.GPR[15] = PC;
	}
	
	this.SetState = function(newState) {
		this.CPSR.T = newState !== this.States.ARM;		
	}
	
	/*
	 * ARM.Simulator.Cpu.IsPrivileged
	 * Returns true if the CPU is in one of the several
	 * privileged modes and false if the CPU is executing
	 * in user mode
	 */
	this.IsPrivileged = function() {
		return this.CPSR.Mode != this.Modes.User;
	}
	
	/*
	 * ARM.Simulator.Cpu.Dump
	 * Compiles and returns a descriptive status object
	 * outlining the current state of the CPU
	 */
	this.Dump = function() {
		var R = {GPR:{}, Banked:{}, Interrupts:{}, CPSR:{}, Cycles:this.Cycles,
			'Instruction count':this.InstCount};
		var M = {0x10: 'User', 0x11: 'FIQ', 0x12:'IRQ', 0x13: 'Supervisor',
			0x17: 'Abort', 0x1B: 'Undefined', 0x1F: 'System'};
		for(var i = 0; i < this.GPR.length; i++)
			R.GPR['R' + i] = this.GPR[i];
		R['Mode'] = M[this.CPSR.Mode] + ' (0x' + this.CPSR.Mode.toString(16) + ')';
		R.Interrupts['IRQ'] = this.CPSR.I;
		R.Interrupts['FIQ'] = this.CPSR.F;
//		R.CPSR['Value'] = '0x' + this.CPSR.toWord().toString(16);
		R.CPSR['N'] = this.CPSR.N ? 1 : 0;
		R.CPSR['Z'] = this.CPSR.Z ? 1 : 0;
		R.CPSR['C'] = this.CPSR.C ? 1 : 0;
		R.CPSR['V'] = this.CPSR.V ? 1 : 0;
    R.CPSR['I'] = this.CPSR.I ? 1 : 0;
    R.CPSR['F'] = this.CPSR.F ? 1 : 0;
    R.CPSR['T'] = this.CPSR.T ? 1 : 0;
    R.CPSR['Mode'] = M[this.CPSR.Mode];
		for(var i in this.Banked) {
			R.Banked[M[i]] = {};
			for(var c in this.Banked[i]) {
				var B = this.Banked[i];
				if(c == 'SPSR')
					R.Banked[M[i]][c] = B[c];
				else
					R.Banked[M[i]]['R' + c] = B[c];
			}
		}
		return R;
	}
	
	/*
	 * ARM.Simulator.Cpu.Step
	 * Performs a single Cpu step, i.e. fetches and
	 * executes a single ARM instruction, then returns
	 * to the caller
	 */
	this.Step = function() {
		var Cycles = 1;

		/* Fetch instruction word */
		var IW = this.Memory.Read(this.GPR[15], 'WORD');

		/* Evaluate condition code */
		var Cond = (IW >> 28) & 0xF;

		if(this.CheckCondition(Cond) == true) {
			/* Retrieve key into dispatch table */
			var D = this.Decode(IW);

			/* The PC value used in an executing instruction is always
				two instructions ahead of the actual instruction
				address because of pipelining */
			this.GPR[15] += 8;

			/* Dispatch instruction. */
			Cycles = ARM.Simulator.Cpu.Instructions[D].call(this, IW);

			this.Cycles = this.Cycles + Cycles;	
			this.InstCount++;

			/* Bail out if instruction raised an exception and altered the PC */
			if(this.PendingException == true) {
				this.PendingException = false;
				return Cycles;
			}

			/* Move on to next instruction, unless executed instruction
				was a branch which means a pipeline flush */
			if(D != 'bx' && D != 'b_bl')
				this.GPR[15] -= 4;
		} else {
			/* Skip over instruction */
			this.GPR[15] = this.GPR[15] + 4;
		}

		return Cycles;
	}

	/*
	 * ARM.Simulator.Cpu.Decode
	 * Decodes instruction words and returns an identifier
	 * to be used as a key into the instruction dispatch
	 * table
	 *
	 * @IW
	 *	32-bit ARMv4T instruction word
	 *
	 * @Return
	 *	Returns a key literal 
	 */
	this.Decode = function(IW) {
		this.cat_0 = function() {
			var bx = 0x12FFF1;
			if(!(((IW >> 4) & 0x1FFFFF) ^ bx))
				return 'bx';
			var b74 = (IW >> 4) & 0xF;
			if(b74 == 9)
				return ((IW >> 24) & 0x01) ? 'swp' : 'mul_mla_mull_mlal';
			if(b74 == 0xB || b74 == 0xD || b74 == 0xF)
				return 'ldrh_strh_ldrsb_ldrsh';
			if(((IW >> 23) & 0x03) == 2 && !((IW >> 20) & 0x01))
				return 'psr';
			if((b74 & 9) != 9)
				return 'data';
		};
		this.cat_1 = function() {
			if(((IW >> 23) & 0x03) == 2 && !((IW >> 20) & 0x01))
				return 'psr';
			return 'data';
		}
		this.cat_2 = function() {
			return ((IW >> 4) & 0x01) ? 'undefined' : 'ldr_str';
		};
		this.cat_3 = function() {
			var B = (IW >> 24) & 0x01;
			if(B)
				return 'swi';
			return ((IW >> 4) & 0x01) ? 'mrc_mcr' : 'cdp';
		}
		var D = {
			0:'cat_0',   1:'cat_1', 2:'ldr_str', 3:'cat_2',
			4:'ldm_stm', 5:'b_bl', 6:'ldc_stc', 7:'cat_3'
		};
		var I = (IW >> 25) & 0x07;
		if(typeof this[D[I]] == 'function')
			return this[D[I]]();
		else
			return D[I];
	}

	/*
	 * ARM.Simulator.Cpu.CheckCondition
	 * Expects a condition code and evaluates the condition
	 * to true or false
	 *
	 * @C
	 *	Condition to check for
	 *
	 * @Return
	 *	true if condition is true, otherwise false
	 */
	this.CheckCondition = function(C) {
		var M = {
			0x00: this.CPSR.Z,						/* EQ */
			0x01: this.CPSR.Z == false,				/* NE */
			0x02: this.CPSR.C,						/* CS */
			0x03: this.CPSR.C == false,				/* CC */
			0x04: this.CPSR.N,						/* MI */
			0x05: this.CPSR.N == false,				/* PL */
			0x06: this.CPSR.V,						/* VS */
			0x07: this.CPSR.V == false,				/* VC */
			0x08: (this.CPSR.C && !this.CPSR.Z),	/* HI */
			0x09: (this.CPSR.Z || !this.CPSR.C),	/* LS */
			0x0A: this.CPSR.N == this.CPSR.V,		/* GE */
			0x0B: this.CPSR.N != this.CPSR.V,		/* LT */
			0x0C: (!this.CPSR.Z &&
					(this.CPSR.N == this.CPSR.V)),	/* GT */
			0x0D: (this.CPSR.Z ||
					(this.CPSR.N != this.CPSR.V)),	/* LE */
			0x0E: true								/* AL */
		};
		if(typeof(M[C]) == 'undefined')
			throw new Error('Invalid condition code: ' + C);
		return M[C];
	}


	Cpu.call(this, O);
};
