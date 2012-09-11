/***********************************************************
 *
 * ARM.Simulator.Device.PICS3C4510B.js
 *	Author:	 Torben Könke
 *	Date:    23.07.2012
 *
 * Implements a simple Programmable Interrupt Controller
 * modeled after the PIC used in Samsung's S3C4510B
 * microcontroller (also known as KS32C50100).
 *
 * Interrupt Controller 'classes' must provide the
 * following public interface methods:
 *
 *	- WireWith( DeviceObj, Pin )
 *		Registers a device with the interrupt controller
 *		by 'wiring' it to the specified pin.
 *		This method triggers an 'OnInterruptRegister'
 *		event with DeviceObj, in order to give it a
 *		chance to react.
 *
 *	- Unwire( DeviceObj )
 *		'Unwires' a previously wired device from the
 *		interrupt controller and frees up the respective
 *		pin of the interrupt controller.
 *		This method triggers an 'OnInterruptUnregister'
 *		event with DeviceObj, in order to give it a
 *		chance to react.
 *
 *	- Interrupt( Source )
 *		Causes a CPU interrupt. Can be called by any
 *		previously wired device if it needs service.
 *		The source parameter can be used by the interrupt
 *		controller to relay to the CPU which device caused
 *		the interrupt.
 *
 **********************************************************/

if(!ARM.Simulator.Device)
	ARM.Simulator.Device = {};

ARM.Simulator.Device.PICS3C4510B = function(O) {
	function PICS3C4510B(O) {
		this.Base	= O.Base;
		this.IntOut = O.IntOut;

		/* PIC has a total of 21 sources */
		this.Lines.length = 21;

		/* Setup default priorities according to register
			RESET values */
		for(var i = 0; i < this.Lines.length; i++)
			this.Priority.push(i);
	}

	this.Recv = null;
	this.Base = 0x00;
	this.Size = 0x34;
	this.Regs = {
		'INTMOD':		0x00000000, 'INTPND':		0x00000000,
		'INTMSK':		0x003FFFFF, 'INTPRI0':		0x03020100,
		'INTPRI1':		0x07060504, 'INTPRI2':		0x0B0A0908,
		'INTPRI3':		0x0F0E0D0C, 'INTPRI4':		0x13121110,
		'INTPRI5':		0x00000014, 'INTOFFSET':	0x00000054,
		'INTOSET_FIQ':	0x00000054, 'INTOSET_IRQ':	0x00000054,
		'INTPNDPRI':	0x00000000, 'INTPNDTST':	0x00000000
	};
	this.Lines = [];
	this.Priority = [];

	this.OnRegister = function(Vm) {
		Vm.Memory.Map({
			Base:	 this.Base,
			Size:	 this.Size,
			Read:	 this.Read,
			Write:	 this.Write,
			Context: this
		});
		/* keep a reference to vm */
		this.Vm = Vm;
		console.info('PIC mapped into memory at 0x' +
			this.Base.toString(16));
	}

	this.OnUnregister = function(Vm) {
		Vm.Memory.Unmap(this.Base);
		console.info('PIC unmapped from memory at 0x' +
			this.Base.toString(16));
	}

	this.Read = function(Address, Type) {
		var Map = {
			0:	'INTMOD',		4:	'INTPND',		8:	'INTMSK',
			12:	'INTPRI0',		16:	'INTPRI1',		20:	'INTPRI2',
			24: 'INTPRI3',		28: 'INTPRI4',		32: 'INTPRI5',
			36: 'INTOFFSET',	40: 'INTOSET_FIQ',	44:	'INTOSET_IRQ',
			48: 'INTPNDPRI',	52: 'INTPNDTST'
		};
		return this.Regs[ Map[ Address - this.Base ] ];
	}

	this.Write = function(Address, Type, Value) {
		var Map = {
			0:	'INTMOD',		4:	'INTPND',		8:	'INTMSK',
			12:	'INTPRI0',		16:	'INTPRI1',		20:	'INTPRI2',
			24: 'INTPRI3',		28: 'INTPRI4',		32: 'INTPRI5',
			36: 'INTOFFSET',	40: 'INTOSET_FIQ',	44:	'INTOSET_IRQ',
			48: 'INTPNDPRI',	52: 'INTPNDTST'
		};
		var Offset = Address - this.Base;
		var Reg = Map[Offset];
		this.Regs[ Reg ] = V;

		if(Offset >= 12 && Offset <= 32)
			this.UpdatePriorities(Offset, Value);
		if(Reg == 'INTPNDTST')
			this.WriteINTPNDTST();
	}

	this.UpdatePriorities = function(O, V) {
		var SPrio = O - 12;
		if(SPrio == 20) {
			this.Prio[20] = V & 0x1F;
			return;
		}
		for(var i = 0; i < 4; i++) {
			var s = i * 8;
			var P = (V >>> s) & 0x1F;

			this.Prio[SPrio + i] = P;
		}
	}

	this.GetPriority = function(L) {
		for(var i in this.Priority) {
			if(this.Priority[i] == L)
				return i;
		}
		throw new Error('priority not specified for ' +
			'interrupt line ' + L);
	}
	
	/*
	 * ARM.Simulator.Device.PICS3C4510B.GetHighestPending
	 *	Gets the pending interrupt source with the highest
	 *	priority.
	 */
	this.GetHighestPending = function() {
		for(var i = 0; i < 21; i++) {
			if((this.Regs['INTPNDPRI'] >> (20 - i)) & 0x01)
				return this.Priority[i];
		}
		throw new Error('No pending interrupts');
	}

	this.WriteINTPNDTST = function() {
		/* Writes to INTPNDTST echo into INTPND and INTPNDPRI */
		this.Regs['INTPND'] = this.Reg['INTPNDTST'];

		this.Regs['INTPNDPRI'] = 0x00;
		for(var i = 0; i < 21; i++) {
			var L = this.Priority[i];
			this.Regs['INTPNDPRI'] |= (((this.Regs['INTPND'] >> L) & 0x01) << i);
		}
	}
	
	this.WireWith = function(O, P) {
		if(P >= this.Lines.length)
			throw new Error('interrupt line out of range: ' + P);
		if(this.Lines[P])
			throw new Error('PIC Interrupt line ' + P + ' is already ' +
				'wired to ' + this.Lines[P]);
		this.Lines[P] = O;
		return P;
	}

	this.Unwire = function(L) {
		if(!this.Lines[L])
			throw new Error('line ' + Line + ' is not wired to a device');
		this.Lines[L] = null;
	}

	this.Interrupt = function(L) {
		/* Set bit in pending register */
		this.Regs['INTPND'] |= (1 << L);

		/* Set bit in pending-by-priority register */
		this.Regs['INTPNDPRI'] |= (1 << this.GetPriority(L));

		/* If source is masked, dismiss */
		if(this.isMasked(L) == true)
			return;

		/* Set INTOFFSET Regs */
		this.Regs['INTOFFSET'] = this.GetHighestPending() << 4;

		/* Not sure about these really */
		this.Regs['INTOSET_FIQ'] = this.Regs['INTOFFSET'];
		this.Regs['INTOSET_IRQ'] = this.Regs['INTOFFSET'];

		/* If INTMOD bit is set, trigger FIQ interrupt */
		var P = ((this.Regs['INTMOD'] >>> L) & 0x01) ? 'FIQ' :
			'IRQ';
		this.IntOut.Interrupt({Pin:P});
	}

	this.IsMasked = function(L) {
		var G = (this.Regs['INTMSK'] >>> 21) & 0x01;
		var T = (this.Regs['INTMSK'] >>> L) & 0x01;
		return (G == 1 || T == 1);
	}

	PICS3C4510B.call(this, O);
}
