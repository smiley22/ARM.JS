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
    this.Buffer = [];
    var size = O.Size || 32;
    for(var i = 0; i < size; i++)
      this.Buffer.push(0);
	}

  this.Regs = [
    0x00, // 0: IOCTL
    0x00  // 1: DATA
  ];

  this.CursorPos = 0;
  this.CursorDirection = 1;
  this.Buffer = [];

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
      // bit strobe triggers previously issued ioctl.
      if (Value & (1 << 7)) {
        this.ExecIOCTL();
      } else {
        this.Regs[Offset] = Value & 0xFF;
      }
    } else if(Reg == 'DATA') {
      this.WriteCharacter(Value);
    }
	}

  this.ExecIOCTL = function() {
    // Just use a simplified variant of the Hitachi HD44780
    // instruction set for now. Our instructions fit into one byte
    // for convenience.
    var shifts = {
      7: this.ClearDisplay,
      6: this.ReturnHome,
      5: this.EntryModeSet,
      4: this.DisplayControl,
      3: this.CursorShift,
      2: this.FunctionSet
    };
    var v = this.Regs[0];
    var numShifts = 0;
    for(var i = 0; i < 7; i++, numShifts++) {
      if (v & (1 << 7))
        break;
      v = (v << 1) & 0xFF;
    }
    if (!shifts[numShifts])
      return;
    shifts[numShifts].call(this, this.Regs[0]);
  }

  this.ClearDisplay = function(v) {
    console.log('LCDController: Clearing display');
    for(var i = 0; i < this.Buffer.length; i++)
      this.Buffer[i] = 0;
    this.CursorPos = 0;
    this.raiseEvent('LCD-Refresh', {
      Buffer: this.Buffer,
      CursorPosition: this.CursorPos
    });
  }

  this.ReturnHome = function(v) {
    console.log('LCDController: Cursor returning home');
    this.CursorPos = 0;
    this.raiseEvent('LCD-Refresh', {
      Buffer: this.Buffer,
      CursorPosition: this.CursorPos
    });
  }

  this.EntryModeSet = function(v) {
    var ID = (v >> 1) & 0x01,
        SH = v & 0x01;
    console.log('LCDController: Setting cursor moving direction to ' +
      (ID ? 'increment' : 'decrement') + ', ' + (SH ? 'enabling' : 'disabling') +
      ' display shift');
    this.CursorDirection = ID;
  }

  this.DisplayControl = function(v) {
    var D = (v >> 2) & 0x01,
        C = (v >> 1) & 0x01,
        B = v & 0x01;
    console.log('LCDController: ' + (D ? 'Enabling' : 'Disabling') + ' Display, ' +
      (C ? 'Showing' : 'Hiding') + ' Cursor, ' + (B ? 'Enabling' : 'Disabling') +
      ' Cursor Blink');
    this.raiseEvent('LCD-Display', {
      TurnDisplayOn : D ? true : false,
      ShowCursor    : C ? true : false,
      CursorBlink   : B ? true : false,
      CursorPosition: this.CursorPos
    });
  }

  this.CursorShift = function(v) {
  }

  this.FunctionSet = function(v) {
    var DL = (v >> 4) & 0xFF, // 4-bit/8-bit
         N = (v >> 3) & 0xFF, // 1-line/2-line
         F = (v >> 2) & 0xFF; // Character Font
    // TODO: just a dummy for now.
    console.log('LCDController: Setting LCD to ' + (DL ? '8' : '4') +
                '-bit, ' + (N ? '2' : '1') + '-line mode');
  }

  this.WriteCharacter = function(c) {
    this.Buffer[this.CursorPos] = String.fromCharCode(c);
    this.CursorPos++;
    if (this.CursorPos >= this.Buffer.length)
      this.CursorPos = 0;
    this.raiseEvent('LCD-Refresh', {
      Buffer: this.Buffer,
      CursorPosition: this.CursorPos
    });
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