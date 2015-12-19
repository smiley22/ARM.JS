/***********************************************************
 *
 * ARM.Simulator.DevBoard.js
 *  Author:   Torben Könke
 *  Date:     26.11.2015
 *
 * Implements a simple microprocessor development board with
 * a couple of LEDs, buttons, a simple 2-line LCD etc.
 *
 * TODO: Document memory layout. etc.
 * - ARM7TDMI-like Processor
 * - 512kb flash ROM
 * - 32kb static RAM
 * - 8 LEDs
 * - 10 Push Buttons (Mapped to Keyboard keys 0-9)
 * - 2-line LCD
 * - Interrupt Controller (PICS3C4510B)
 * - 2 UART (16750)
 *
 **********************************************************/

var ARM = ARM || {Simulator:{}};

ARM.Simulator.DevBoard = function(O) {
  /*
   * ARM.Simulator.DevBoard.Constructor
   *  Initializes a new DevBoard Object.
   *
   * @name
   *  a name or id that can be used to identify the DevBoard
   *  instance in event handlers.
   */
  function DevBoard(name) {
    this.name = name;
    this.Reset();
  }

  /*
   * Resets the DevBoard.
   */
  this.Reset = function() {
    var mem  = new ARM.Simulator.Memory([
      { Base: 0x00000000, Size: 0x00080000 }, // 512kb
      { Base: 0x00400000, Size: 0x00008000 }, //  32kb
    ]);
    var cpu = new ARM.Simulator.Cpu({
      Clockrate: 16.8,
        Memory: mem
    });
    this.VM = new ARM.Simulator.Vm({
      'Cpu':    cpu,
      'Memory': mem
    });
    this.initLED(mem);
    this.initButtons(mem);
    this.initSystemControlBlock(mem);
    // Create devices and map into address space.
    var devices = {
      'lcd': new ARM.Simulator.Device.LCDController({
        'Base': 0xE000C000
      }),
      // UART0
      'uart0': new ARM.Simulator.Device.UART16750({
        'Base': 0xE0000000, Name: 'UART0',
        'Interrupt': function(rxdInt) {
          // UART0 receive interrupt  -> PIC line 5
          // UART0 transmit interrupt -> PIC line 4
          devices.pic.Interrupt(rxdInt ? 5 : 4);
        }
      }),
      // UART1
      'uart1': new ARM.Simulator.Device.UART16750({
        'Base': 0xE0004000, Name: 'UART1',
        'Interrupt': function(rxdInt) {
          // UART1 receive interrupt  -> PIC line 7
          // UART1 transmit interrupt -> PIC line 6
          devices.pic.Interrupt(rxdInt ? 7 : 6);
        }
      }),
      // PIC
      'pic': new ARM.Simulator.Device.PICS3C4510B({
        'Base': 0xE0014000,
        'OnInterrupt': function(pin) {
          // pin is either FIQ or IRQ.
          cpu.TriggerException(cpu.Exceptions[pin]);
        }
      }),
      // TIMER0
      'timer0': new ARM.Simulator.Device.Timer({
        'Base': 0xE0018000,
        'Interrupt': function() {
          // User should:
          //  Check equal and overflag flags to figure out what happened
          //  Clear the respective flag.
          devices.pic.Interrupt(8);
        }
      }),
      // TIMER1
      'timer1': new ARM.Simulator.Device.Timer({
        'Base': 0xE001C000,
        'Interrupt': function() {
          devices.pic.Interrupt(9);
        }
      }),
      // RTC
      'rtc': new ARM.Simulator.Device.DS1307({
        'Base': 0xE0020000
      })
    };
    for(var d in devices)
      this.VM.RegisterDevice(devices[d], this.name);
    this.raiseEvent('Reset');
  }

  /*
   * Uploads the specified image to the DevBoard.
   *
   * @Img
   *  The executable image to upload to the DevBoard.
   */
  this.Flash = function(Img) {
    var type = Object.prototype.toString.call( Img );
    if( type == '[object Array]' || type == '[object Uint8Array]')
      this.VM.LoadELF(Img);
    else
      this.VM.LoadImage(Img);
    return this;
  }

  
  /*
   * Executes the uploaded image.
   */
  this.Run = function(n) {
    this.VM.Run(n);
  }

  /*
   * Private Methods and Properties-
   */
  this.initLED = function(mem) {
    var base = 0xE0008000;
    var ledStatus = [];
    mem.Map({
      Base: base , Size:0x00004000, Context: this,
      Read: function(A, T) {
        var mask = 0;
        for(var i = 0; i < 8; i++)
          mask |= ((ledStatus[i] ? 1 : 0) << i);
        return mask;
      },
      Write: function(A, T, V) {
        // Raise JS event 'GUI' can attach to for rendering the LEDs.
        // 0 = LED n is off.
        // 1 = LED n is on.
        var s = [];
        for(var i = 0; i < 8; i++)
          s.push((V & (1 << i)) ? 1 : 0);
        this.raiseEvent('LED', s);
        this.LEDStatus = s;
      }
    });
  }

  this.initButtons = function(mem) {
    var base = 0xE0010000;
    this.buttonFlags = 0;
    mem.Map({
      Base: base, Size: 0x00004000, Context: this,
      Read: function(A, T) {
        var O = A - base;
        if(O == 0)
          return this.buttonFlags;
      },
      Write: function(A, T, V) {
        // Writes to Button Register are ignored.
      }
    });
    // Remove in case already installed. This happens if dev-board is
    // being reset.
    if(this.keypressEventListener) {
      window.removeEventListener('keypress',
        this.keypressEventListener);
    }
    var that = this;
    this.keypressEventListener = function(e) {
      var charCode = (typeof e.which == "number") ? e.which : e.keyCode
      if (charCode < 48 || charCode > 57)
        return;
      var n = charCode - 48;
      // set the bit corresponding to button being pressed.
      that.buttonFlags |= (1 << n);
    }
    window.addEventListener('keypress', this.keypressEventListener);
    if(this.keyupEventListener) {
      window.removeEventListener('keyup',
        this.keyupEventListener);
    }
    this.keyupEventListener = function(e) {
      var charCode = (typeof e.which == "number") ? e.which : e.keyCode
      if (charCode < 48 || charCode > 57)
        return;
      var n = charCode - 48;
      // clear corresponding bit.
      that.buttonFlags &= ~(1 << n);
    }
    window.addEventListener('keyup', this.keyupEventListener);
  }

  this.initSystemControlBlock = function(mem) {
    var base = 0xE01FC000;
    mem.Map({
      Base: base , Size:0x00004000, Context: this,
      Read: function(A, T) {
      },
      Write: function(A, T, V) {
        var regMap = {
          '0':  'PCON'
        };
        var reg = regMap[ A - base ];
        switch(reg) {
          case 'PCON':
            if(V & 0x01)
              throw 'PowerOffException';
            break;
          default:
            break;
        }
      }
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
    // AFAIK Plain JS Objects can not use EventTarget so we
    // raise all events on window and use the DevBoards name
    // as a means of identifying the instance that raised the
    // event.
     window.dispatchEvent(new CustomEvent(event, {
       detail: { 'devBoard': this.name, 'params': params } })
     );
  }

  DevBoard.call(this, O);
};