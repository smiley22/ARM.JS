// A simple DevBoard Virtual Machine with some simple
// HW devices mapped into memory and a pseudo console-device
// to enable printing to the browser's console window from
// ARM programs.
var DevBoard = function() {
	this.VM = null;

	function DevBoard() {
		var Mem = new ARM.Simulator.Memory([
			{ Base: 0x00000000, Size: 0x10000 },
			{ Base: 0x40000000, Size: 0x10000 }
		]);
		var Cpu = new ARM.Simulator.Cpu({
			Clockrate: 16.8,
			Memory: Mem
		});

		this.VM = new ARM.Simulator.Vm({
			'Cpu':		Cpu,
			'Memory': Mem
		});

    // Map "Console Device" into memory at 0x60000000.
		var Console = new ARM.Simulator.Device.Console({Base:0x60000000});
		this.VM.RegisterDevice(Console);
	}

	DevBoard.call(this);
}

var Board = new DevBoard();