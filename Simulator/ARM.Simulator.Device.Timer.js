/***********************************************************
 *
 * ARM.Simulator.Device.Timer.js
 *  Author: Torben Könke
 *  Date:   12.12.2015
 *
 * Implements a simple timer tied to the cpu clock.
 *
 **********************************************************/

if(!ARM.Simulator.Device)
  ARM.Simulator.Device = {};

ARM.Simulator.Device.Timer = function(O) {
  function Timer(O) {
    this.Base = O.Base;
    this.Name = O.Name;
    this.Interrupt = O.Interrupt;
  }

  this.Size = 0x0C;
  this.Regs = {
    'MODE'  : 0x00000000,
    'COUNT' : 0x00000000,
    'COMP'  : 0x00000000
  };
  this.CBHandle = null;

  this.ZRet = 0;
  this.Cue  = 0;
  this.Cmpe = 0;
  this.Ovfe = 0;
  this.Equf = 0;
  this.Ovff = 0;
    
  this.OnRegister = function(Vm) {
    Vm.Memory.Map({
      Base:     this.Base,
      Size:     this.Size,
      Read:     this.Read,
      Write:    this.Write,
      Context:  this
    });
    /* keep a reference to vm */
    this.Vm = Vm;
    console.info('Timer device mapped into memory at 0x' +
      this.Base.toString(16));
  }
  
  this.OnUnregister = function(Vm) {
    Vm.Memory.Unmap(this.Base);
    console.info('Timer device unmapped from memory at 0x' +
      this.Base.toString(16));
  }
  
  this.Read = function(Address, Type) {
    var Map = { 0: 'MODE', 4: 'COUNT', 8: 'COMP' };
    return this.Regs[ Map[ Address - this.Base ] ];
  }
  
  this.Write = function(Address, Type, Value) {
    var Map = { 0: 'MODE', 4: 'COUNT', 8: 'COMP' };
    var Reg = Map[ Address - this.Base ];
    this.Regs[ Reg ] = Value;
    if(Reg == 'MODE')
      this.WriteMODE(Value);
    else {
      // COUNT and COMP are 16-bit registers.
      this.Regs[ Reg ] &= 0xFFFF;
    }
  }

  this.WriteMODE = function(v) {
    // MODE Register
    //  0:1 -> Clock Selection
    //         00 -> CPU Clock
    //         01 -> CPU Clock / 16
    //         10 -> CPU Clock / 128
    //         11 -> CPU Clock / 256
    //    2 -> Zero Return
    //          0 -> The counter keeps counting, ignoring reference value.
    //          1 -> The counter is cleared to 0 when the counter value is equal
    //               to the reference value.
    //    3 -> Count-Up Enable
    //          0 -> Stops counting.
    //          1 -> Restarts counting. The counter value is not reset on restart.
    //    4 -> Compare Interrupt Enable
    //          0 -> A compare interrupt is not generated.
    //          1 -> An interrupt is generated when the counter value is equal to
    //               the reference value.
    //    5 -> Overflow Interrupt Enable
    //          0 -> An overflow interrupt is not generated.
    //          1 -> An interrupt is generated when an overflow occurs.
    //    6 -> Equal Flag
    //          The value is set to 1 by hardware when a compare interrupt occurs.
    //          Writing 1 clears the equal flag.
    //    7 -> Overflow Flag
    //          The value is set to 1 by hardware when an overflow interrupt occurs.
    //          Writing 1 clears the overflow flag.
    //
    this.ZRet = (v >> 2) & 0x01;
    this.Cue  = (v >> 3) & 0x01;
    this.Cmpe = (v >> 4) & 0x01;
    this.Ovfe = (v >> 5) & 0x01;
    this.Equf = (v >> 6) & 0x01;
    this.Ovff = (v >> 7) & 0x01;
    
    var cycles = [1, 16, 128, 256];
    // The number of CPU cycles to run before incrementing the counter value.
    var numCycles = cycles[ v & 0x03 ];

    // Timer is being enabled.
    if (this.Cue == 1) {
      if (this.CBHandle)
        this.Vm.UnregisterCallback(this.CBHandle);
      this.CBHandle = this.Vm.RegisterCallback({
        Cycles: numCycles,
        Callback: this.Tick,
        Context: this
       });
    } else {
      if (this.CBHandle)
        this.Vm.UnregisterCallback(this.CBHandle);
      this.CBHandle = null;
    }
  }

  this.Tick = function() {
    this.Regs['COUNT'] = this.Regs['COUNT'] + 1;
    if(this.Regs['COUNT'] == this.Regs['COMP']) {
      // Set equal flag.
      this.Regs['MODE'] |= (1 << 6);
      if(this.Cmpe == 1)
        this.Interrupt();
      if(this.ZRet == 1)
        this.Regs['COUNT'] = 0;
    } else if(this.Regs['COUNT'] == 0x10000) { // Overflow
      this.Regs['COUNT'] = 0;
      // Set overflow flag.
      this.Regs['MODE'] |= (1 << 7);
      if(this.Ovfe == 1)
        this.Interrupt();
    }
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

  Timer.call(this, O);
}
