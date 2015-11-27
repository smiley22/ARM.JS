/***********************************************************
 *
 * ARM.Simulator.Vm.js
 *  Author:   Torben Könke
 *  Date:     21.07.2012
 *  Modified: 26.11.2015
 *
 * Implements a simple virtual machine consisting of a ARM7-like
 * processor, memory and peripherals.
 *
 **********************************************************/

var ARM = ARM || {Simulator:{}};

ARM.Simulator.Vm = function(O) {
  /*
   * ARM.Simulator.Vm.Constructor
   *  Initializes a new Vm Object.
   *
   * @O
   *  Object providing the following properties:
   *   "Cpu":   An object of type ARM.Simulator.Cpu
   *   "Memory":  An object of type ARM.Simulator.Memory
   *
   */
  function Vm(O) {
    this.Cpu        = O.Cpu;
    this.Memory     = O.Memory;
    this.Devices    = [];
    this.Callbacks  = [];
  }

  /*
   * ARM.Simulator.Vm.RegisterDevice
   *  Registers a new device with the virtual machine.
   *
   * @D
   *  Device object to register.
   *
   */
  this.RegisterDevice = function(D) {
    for(var i in this.Devices) {
      if(this.Devices[i] == D)
        throw new Error('Device is already registered with VM');
    }
    this.Devices.push(D);
    if(typeof D['OnRegister'] == 'function')
      D['OnRegister'].call(D, this);
  }


  /*
   * ARM.Simulator.Vm.RegisterDevice
   *  Unregisters a previously registered device with
   *  the virtual machine.
   *
   * @D
   *  Device object to unregister.
   *
   */
  this.UnregisterDevice = function(D) {
    for(var i in this.Devices) {
      if(this.Devices[i] == D) {
        if(typeof D['OnUnregister'] == 'function')
          D['OnUnregister'].call(D, this);
        this.Devices.splice(i, 1);
        return;
      }
    }
    throw new Error('Device is not registered with VM');
  }

  /*
   * ARM.Simulator.Vm.RegisterCallback
   *  Registers a callback function with the VM which will
   *  be called after a specified amount of time or CPU
   *  clock cycles.
   *
   * @O
   *  Object providing the following properties:
   *   "Cycles":    Number of clock cycles to run the CPU
   *          before the callback function is invoked.
   *   "Time":    Time in seconds to run the CPU before
   *          the callback function is invoked.
   *   "Periodic":  Optional (defaults to 'true'). If false
   *          is specified, the callback function
   *          will be invoked exactly once, otherwise
   *          it is invoked continously.
   *   "Callback":  The callback function to call. It takes
   *          one parameter which is of type
   *          ARM.Simulator.Vm
   *   "Context":   The context (of the this-pointer) with
   *          which the function specified under
   *          "Callback" will be invoked
   *
   *  Notes:
   *   The "Time" and "Cycles" properties are mutual exclusive,
   *   only one must be provided.
   */
  this.RegisterCallback = function(O) {
    if(!(O.Cycles || O.Time) || (O.Cycles && O.Time))
      throw new Error('"Cycles" or "Time" property must be provided');
    /* calculate number of clock cycles from time */
    if(O.Time)
      O.Cycles = parseInt(O.Time / (1 / this.Cpu.Clockrate));
    var Length = this.Callbacks.push({
      Cycles:   O.Cycles,
      Left:     O.Cycles,
      Periodic: O.Periodic || true,
      Callback: O.Callback,
      Context:  O.Context
    });
    return (Length - 1);
  }

  /*
   * ARM.Simulator.Vm.UnregisterCallback
   *  Unregisters a previously registered callack function.
   *
   * @O
   *  Handle obtained by the call to RegisterCallback that
   *  registered the callback function.
   *
   */
  this.UnregisterCallback = function(O) {
    if(O < 0 || O >= this.Callbacks.length)
      throw new Error('Invalid handle');
    this.Callbacks.splice(O, 1);
  }

  /*
   * ARM.Simulator.Vm.LoadELF
   *  Loads an ELF executable image into the virtual machine.
   *
   * @ELFFile
   *  A byte array containing an ELF file.
   *
   */
  this.LoadELF = function(ELFFile) {
    ARM.Simulator.Loader.LoadELF(this.Memory, ELFFile);
  }

  /*
   * ARM.Simulator.Vm.LoadImage
   *  Loads a raw assembled image into the virtual machine.
   *
   * @IMGFile
   *  An image object as is produced by the assembler component.
   *
   */
  this.LoadImage = function(IMGFile) {
    ARM.Simulator.Loader.LoadImage(this.Memory, IMGFile);
  }

  /*
   * ARM.Simulator.Vm.Run
   *  Run the VM for a specified number of CPU cycles.
   *
   * @N
   *  Number of CPU cycles to run the VM before returning
   *  to the caller.
   *
   */
  this.Run = function(N) {
    var Requested = N;
    while(N > 0) {
      var Cycles = this.Cpu.Step();
      /* See if any callbacks need to be invoked */
      for(var i in this.Callbacks) {
        var Cb = this.Callbacks[i];
        Cb.Left = Cb.Left - Cycles;
        if(Cb.Left <= 0) {
          Cb.Callback.call(Cb.Context, this);
          if(Cb.Periodic === false)
            this.Callbacks.splice(i, 1);
          else
            Cb.Left = Cb.Cycles;
        }
      }
      N = N - Cycles;
    }
    /* Return the actual number of clock cycles the CPU ran */
    return Requested - N;
  }

  Vm.call(this, O);
}
