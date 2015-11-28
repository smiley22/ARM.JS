/***********************************************************
 *
 * ARM.Simulator.Device.LCDController.js
 *	Author:  Torben Könke
 *	Date:    28.11.2015
 *
 * Implements a very simple LCD controller for a 2-line LCD.
 *
 **********************************************************/

var ARM = ARM || {Simulator:{}};
if(!ARM.Simulator.Device)
	ARM.Simulator.Device = {};

ARM.Simulator.Device.LCDController = function(O) {
	function LCDController(O) {
		this.Base = O.Base;
	}

  this.Regs = [
    0x00, // 0: IOCTL
    0x00  // 1: DATA
  ];

	this.OnRegister = function(Vm, name) {
		Vm.Memory.Map({
			Base:    this.Base,
			Size:    0x02,
			Read:    this.Read,
			Write:   this.Write,
			Context: this
		});
    this.BoardName = name;
		console.info('LCDController device mapped into memory at 0x' +
			this.Base.toString(16));
	}

	this.OnUnregister = function(Vm) {
		Vm.Memory.Unmap(this.Base);
		console.info('LCDController device unmapped from memory');
	}

	this.Read = function(Address, Type) {
	}

	this.Write = function(Address, Type, Value) {
		var Map = {
			'0': 'IOCTL',
			'1': 'DATA'
		};
    var Offset = Address - this.Base;
    var Reg = Map[ Offset ];
    if(Reg == 'IOCTL') {
      if (Value & (1 << 7)) {
        console.log('Executing IOCTL Call:' + this.Regs[Offset]);
        this.ExecIOCTL();
      } else {
        this.Regs[Offset] = Value & 0xFF;
        console.log('IOCTL with ' + Value);
      }
    }
	}

  this.ExecIOCTL = function() {
    var v = this.Regs[0];
    // bla bla

    this.raiseEvent('LCD-Power', true);
  }

   /*
    * Raises a JS event on the window object.
    *
    * @event
    *  The name of the event to raise.
    * @params
    *  The parameters to pass along with the event in the
    *  'details' field of CustomEvent.
    */
  this.raiseEvent = function(event, params) {
     window.dispatchEvent(new CustomEvent(event, {
       detail: { 'devBoard': this.BoardName, 'params': params } })
     );
  }


  LCDController.call(this, O);

}