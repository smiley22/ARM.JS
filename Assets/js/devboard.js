// A simple DevBoard Virtual Machine with some simple
// HW devices mapped into memory and a simple 'video'-device
// to enable printing characters to the screen from within
// ARM programs.
var DevBoard = function() {
	this.VM = null;

	function DevBoard() {
		var Mem = new ARM.Simulator.Memory([
			{ Base: 0x00000000, Size: 0x10000 },
			{ Base: 0x00040000, Size: 0x10000 }
		]);
		var Cpu = new ARM.Simulator.Cpu({
			Clockrate: 16.8,
			Memory: Mem
		});

		this.VM = new ARM.Simulator.Vm({
			'Cpu':		Cpu,
			'Memory': Mem
		});

    var fw = new ARM.Simulator.Device.FW({
      Base:0xFFFFFFFF
    });
    this.VM.RegisterDevice(fw);
    // Map "Video Device" into memory at 0x60000000.
		var video = new ARM.Simulator.Device.Video({
      Base:0x60000000,
      Size:0x1000
     });
		this.VM.RegisterDevice(video);
	}

	DevBoard.call(this);
}

var Board = new DevBoard();