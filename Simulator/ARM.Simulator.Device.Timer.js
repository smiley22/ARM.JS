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
    this.Regs[ Reg ] = V;
    if(Reg == 'MODE')
      this.WriteMODE();
    else {
      // COUNT and COMP are 16-bit registers.
      this.Regs[ Reg ] &= 0xFFFF;
    }
  }

  this.WriteMODE = function() {
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
