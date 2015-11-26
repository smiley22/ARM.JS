/***********************************************************
 *
 * ARM.Simulator.Device.Video.js
 *	Author:  Torben Könke
 *	Date:    09.06.2012
 *
 * Implements a simple memory-mapped 'video adapter'
 *	for outputting characters to STDOUT. 
 *
 **********************************************************/

var ARM = ARM || {Simulator:{}};
if(!ARM.Simulator.Device)
	ARM.Simulator.Device = {};

ARM.Simulator.Device.Video = function(O) {
	function Video(O) {
		this.Base = O.Base;
    this.Size = O.Size;
    for(var i = 0; i < this.Size; i++)
      this.Buffer.push(0);
	}

	this.Buffer = [];
	this.Base	= 0x00;

	this.OnRegister = function(Vm) {
		Vm.Memory.Map({
			Base:    this.Base,
			Size:    this.Size,
			Read:    this.Read,
			Write:   this.Write,
			Context: this
		});

		console.info('Video device mapped into memory at 0x' +
			this.Base.toString(16));
	}

	this.OnUnregister = function(Vm) {
		Vm.Memory.Unmap(this.Base);

		console.info('Video device unmapped from memory');
	}

	this.Read = function(Address, Type) {
		throw new Error('illegal');
	}

	this.Write = function(Address, Type, Value) {
		var T = {'BYTE':1, 'HWORD':2, 'WORD':4, '2BYTE':2, '4BYTE':4};
    var Offset = Address - this.Base;
		for(var i = 0; i < T[Type.toUpperCase()]; i++) {
      var b = (Value >>> (8 * i)) & 0xFF;
      this.Buffer[ Offset ] = b;
      window.dispatchEvent(new CustomEvent('VideoBlit', {
        detail: String.fromCharCode(b) }));
    }
	}

	/* ... */

	Video.call(this, O);
}
