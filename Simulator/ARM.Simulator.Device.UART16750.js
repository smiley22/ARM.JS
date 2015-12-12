/***********************************************************
 *
 * ARM.Simulator.Device.UART16750.js
 *	Author:	 Torben Könke
 *	Date:    22.07.2012
 *
 * Implements a simple Universal Asynchronous Receiver
 * Transmitter (UART) chip modeled after the National
 * Semiconductor 16750 UART.
 *
 **********************************************************/

if(!ARM.Simulator.Device)
	ARM.Simulator.Device = {};

ARM.Simulator.Device.UART16750 = function(O) {
	function UART16750(O) {
		this.Base = O.Base;
    this.Name = O.Name;
    this.Interrupt = O.Interrupt;
	}

	this.Base		= 0x00;
	this.Size		= 0x20;
	this.CBHandle	= null;
	this.RecvLine	= [];
	this.RxDFIFO	= [];
	this.TxDFIFO	= [];
	this.Regs		= {
		'RBR':0x00, 'THR':0x00, 'DLL':0x01, 'DLH':0x00,
		'IER':0x00, 'IIR':0x00, 'FCR':0x01, 'LCR':0x03,
		'LSR':0x00, 'SRR':0x00
	};
	this.Subscribers = [];

	this.OnRegister = function(Vm, name) {
		Vm.Memory.Map({
			Base:	 this.Base,
			Size:	 this.Size,
			Read:	 this.Read,
			Write:	 this.Write,
			Context: this
		});
		/* keep a reference to vm */
		this.Vm = Vm;
    this.BoardName = name;

		console.info('UART device mapped into memory at 0x' +
			this.Base.toString(16));
	}

	this.OnUnregister = function(Vm) {
		this.ClearCallback();
		Vm.Memory.Unmap(this.Base);
		console.info('UART device unmapped from memory at 0x' +
			this.Base.toString(16));
	}

	this.Read = function(Address, Type) {
		var Map = {
			'0':  this.DLAB() ? 'DLL' : 'RBR',
			'4':  this.DLAB() ? 'DLH' : 'IER',
			'8':  'IIR',
			'12': 'LCR',
			'20': 'LSR',
			'28': 'SRR'
		};
		var Offset = Address - this.Base;
		var Reg = Map[ Offset ];

		if(Reg == 'RBR')
			return this.ReadRBR();
		return this.Regs[ Reg ] & 0xFF;
	}

	this.Write = function(Address, Type, Value) {
		var Map = {
			'0':  this.DLAB() ? 'DLL' : 'THR',
			'4':  this.DLAB() ? 'DLH' : 'IER',
			'8':  'FCR',
			'12': 'LCR',
			'20': 'LSR',
			'28': 'SRR'
		};
		var Offset = Address - this.Base;
		var Reg = Map[ Offset ];
		this.Regs[ Reg ] = Value & 0xFF;

		if(Reg == 'DLL' || Reg == 'DLH')
			this.SetCallback();
		else if(Reg == 'THR')
			this.WriteTHR();
		else if(Reg == 'FCR')
			this.WriteFCR();
	}

	this.DLAB = function() {
		return ((this.Regs.LCR >>> 7) & 0x1);
	}

	this.ReadRBR = function() {
		var R = null;
		/* Take next byte from RXDFIFO */
		if(this.RxDFIFO.length > 0)
			R = this.RxDFIFO.shift();
		/* Clear Data-Ready Bit of LSR if RxDFIFO is empty */
		if(this.RxDFIFO.length == 0)
			this.Regs['LSR'] &= ~0x01;
		/* Clear FIFO Overrun bit */
		this.Regs['LSR'] &= ~0x02;
		if(R === null) {
			console.info('Warning: Reading RBR with empty RxDFIFO');
			return 0;
		}
		return R;
	}

	this.WriteTHR = function() {
		/* FIFOs of 16750 can hold 64 instead of 16 bytes if enabled */
		var FIFOSize = (this.Regs['FCR'] & 0x20) ? 64 : 16;
		/* FIFO is full */
		if(this.TxDFIFO.length == FIFOSize) {
			console.info('Warning: TxDFIFO is full!!!');
			return;
		}
		this.TxDFIFO.push(this.Regs['THR']);
		/* FIFO is full, clear bit 5 of LSR */
		if(this.TxDFIFO.length == FIFOSize)
			this.Regs['LSR'] &= ~(1 << 5);
		/* Enable callback to start transmission */
		if(this.CBHandle === null)
			this.SetCallback();
	}

	this.WriteFCR = function() {
		/* Clear receive FIFO */
		if(this.Regs['FCR'] & 0x02) {
			this.RxDFIFO.length = 0;
      this.Regs['LSR'] |= (1 << 5);
    }
		/* Clear transmit FIFO */
		if(this.Regs['FCR'] & 0x04) {
			this.TxDFIFO.length = 0;
      this.Regs['LSR'] |= (3 << 5);
    }
		/* Clear bits reset automatically to 0 */
		this.Regs['FCR'] &= 0xF9;
	}

	this.CalcBaudrate = function() {
		var DL = (this.Regs['DLH'] << 8) +
				  this.Regs['DLL'];
		/* Clock rate of UART is 115.200 KHz */
		return parseInt(115200 / DL);
	}

	this.SetCallback = function() {
		var BPW = [5, 6, 7, 8];
		var N = 2 + BPW[this.Regs['LCR'] & 0x03];
		/* second STOP bit */
		if(this.Regs['LCR'] & 0x04)
			N = N + 1;
		/* parity bit */
		if(this.Regs['LCR'] & 0x38)
			N = N + 1;
		var Transmissions = parseInt(this.CalcBaudrate() / N);
		var Interval = 1 / Transmissions;

		/* clear old and register new callback */
		if(this.CBHandle !== null)
			this.Vm.UnregisterCallback(this.CBHandle);
		this.CBHandle = this.Vm.RegisterCallback({
			Time:		Interval,
/*Cycles: 1,*/
			Callback:	function(P) { this.Callback(P); },
			Context:	this
		});
	}

	this.ClearCallback = function() {
		if(this.CBHandle !== null) {
			this.Vm.UnregisterCallback(this.CBHandle);
			this.CBHandle = null;
		}
	}

	this.Callback = function(Vm) {
		/* Got data to put into RxDFIFO? */
		if(this.RecvLine.length > 0)
			this.ReadByte();
		/* Got data in TxDFIFO to send out? */
		if(this.TxDFIFO.length > 0)
			this.WriteByte();
		/* Unregister callback, if idle */
		if(this.RecvLine.length == 0 && this.TxDFIFO.length == 0)
			this.ClearCallback();
	}

	this.ReadByte = function() {
		var FIFOSize = (this.Regs['FCR'] & 0x20) ? 64 : 16;
		var Trigger = FIFOSize == 64 ? [1, 16, 32, 56] :
			[1, 4, 8, 14];
		var B = this.RecvLine.shift();
		if(this.RxDFIFO.length < FIFOSize) {
			this.RxDFIFO.push(B);
			/* Set Data-Ready Bit */
			this.Regs['LSR'] |= 0x01;
			var Lv = (this.Regs['FCR'] >> 6) & 0x03;
			if(this.RxDFIFO.length >= Trigger[Lv]) {
				if(this.Regs['IER'] & 0x01)
					this.CauseInterrupt(true);
			}
		} else {
			/* FIFO is full, set Overrun bit */
			this.Regs['LSR'] |= 0x02;
		}
	}

	this.WriteByte = function() {
		var B = this.TxDFIFO.shift();
		/* set TxDFIFO empty (read: 'not-full') bit */
		this.Regs['LSR'] |= (1 << 5);
		/* if everything has been sent, set
			'Empty Data Holding Registers' bit */
		if(this.TxDFIFO.length == 0) {
			this.Regs['LSR'] |= (1 << 6);
			if(this.Regs['IER'] & 0x02)
				this.CauseInterrupt(false);
		}
		else
			this.Regs['LSR'] &= ~(1 << 6);
    this.raiseEvent('UART-Data', {'Name': this.Name, 'Byte': B });
	}

	this.CauseInterrupt = function(RXDInt) {
		var FIFO64 = (this.Regs['FCR'] & 0x20) ? 1 : 0;
		var R = RXDInt ? 0x02 : 0x01;
		this.Regs['IIR'] = ((0x03 << 5) | (FIFO64 << 4) |
			(R << 1));
		/* Trigger Interrupt */
		if(!this.Interrupt)
			return;
		this.Interrupt(RXDInt);
	}

	/* public */
	this.SendData = function(D) {
		this.RecvLine = this.RecvLine.concat(D);
		if(this.CBHandle === null)
			this.SetCallback();
	}

	this.toString = function() {
		return this.Name || 'Device.UART16750';
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

	UART16750.call(this, O);
}
