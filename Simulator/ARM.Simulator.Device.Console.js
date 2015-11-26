/***********************************************************
 *
 * ARM.Simulator.Device.Console.js
 *	Author:	 Torben Könke
 *	Date:    09.06.2012
 *
 * Implements a simple memory-mapped stdout that
 *	outputs data to the browser's console. 
 *
 **********************************************************/

var ARM = ARM || {Simulator:{}};
if(!ARM.Simulator.Device)
	ARM.Simulator.Device = {};

ARM.Simulator.Device.Console = function(O) {
	function Console(O) {
		this.Base = O.Base;
	}

	this.Buffer = [];
	this.Base	= 0x00;
	this.Ctl	= 0x01;

	this.OnRegister = function(Vm) {
		Vm.Memory.Map({
			Base:	this.Base,
			Size:	0x1000,
			Read:	this.Read,
			Write:	this.Write,
			Context: this
		});

		console.info('Console device mapped into memory at 0x' +
			this.Base.toString(16));
	}

	this.OnUnregister = function(Vm) {
		Vm.Memory.Unmap(this.Base);

		console.info('Console device unmapped from memory');
	}

	this.Read = function(Address, Type) {
		throw new Error('illegal');

	}

	this.Write = function(Address, Type, Value) {
		var Offset = Address - this.Base;
		if(Offset == this.Ctl)
			return this.Control(Value);
		var T = {'BYTE':1, 'HWORD':2, 'WORD':4, '2BYTE':2, '4BYTE':4};
		for(var i = 0; i < T[Type.toUpperCase()]; i++)
			this.Buffer.push((Value >>> (8 * i)) & 0xFF);
	}

	this.Control = function(Value) {
		if(Value == 1)
			this.Flush();
    else if(Value ==40)
      throw 'HaltCpuSysCall';
	}

	this.Flush = function() {
		var Str = '';
		for(var i = 0; i < this.Buffer.length; i++)
			Str = Str + String.fromCharCode(this.Buffer[i]);

		this.Buffer.length = 0;
		console.info(Str);
	}

	/* ... */

	Console.call(this, O);
}
