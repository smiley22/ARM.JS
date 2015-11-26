/***********************************************************
 *
 * ARM.Simulator.Device.FW.js
 *	Author:  Torben Könke
 *	Date:    26.11.2015
 *
 * Implements a simple memory-mapped 'firmware' that provides
 *	services for breaking out of the simulator and return
 *  control to the caller, etc.
 *
 **********************************************************/

var ARM = ARM || {Simulator:{}};
if(!ARM.Simulator.Device)
	ARM.Simulator.Device = {};

ARM.Simulator.Device.FW = function(O) {
	function FW(O) {
		this.Base = O.Base;
	}

	this.OnRegister = function(Vm) {
		Vm.Memory.Map({
			Base:    this.Base,
			Size:    0x01,
			Read:    this.Read,
			Write:   this.Write,
			Context: this
		});
		console.info('Firmware device mapped into memory at 0x' +
			this.Base.toString(16));
	}

	this.OnUnregister = function(Vm) {
		Vm.Memory.Unmap(this.Base);
		console.info('Firmware device unmapped from memory');
	}

	this.Read = function(Address, Type) {
		throw new Error('illegal');
	}

	this.Write = function(Address, Type, Value) {
		var T = {'BYTE':1, 'HWORD':2, 'WORD':4, '2BYTE':2, '4BYTE':4};
		for(var i = 0; i < T[Type.toUpperCase()]; i++) {
      var b = (Value >>> (8 * i)) & 0xFF;
      switch (b) {
        // SysCallHaltCpu
        case 1:
          throw 'SysCallHaltCpu';
        default:
          throw 'UnknownSysCall';
      }
    }
	}
  FW.call(this, O);
}
