/***********************************************************
 *
 * ARM.Simulator.Cpu.Cpsr.js
 *	Author:	 Torben Könke
 *	Date:    09.06.2012
 *
 * Implements a simple ARM CPU simulator which simulates
 *	the ARMv4T instruction architecture.
 *
 **********************************************************/

var ARM = ARM || {Simulator:{Cpu:{}}};

ARM.Simulator.Cpu.Cpsr = function() {
	this.N = this.Z = this.C = this.V =
	this.F = this.I = this.T = false;

	this.Mode = 0x1F;

	this.toWord = function() {
		var _N = this.N ? 1 : 0,
			_Z = this.Z ? 1 : 0,
			_C = this.C ? 1 : 0,
			_V = this.V ? 1 : 0,
			_I = this.I ? 1 : 0,
			_F = this.F ? 1 : 0,
			_T = this.T ? 1 : 0;
		return ((_N << 31) | (_Z << 30) | (_C << 29) | (_V << 28) |
				(_I << 7 ) | (_F << 6 ) | (_T << 5 ) | this.Mode).toUint32();
	}
};

ARM.Simulator.Cpu.Cpsr.fromWord = function(W) {
	var _cpsr = new ARM.Simulator.Cpu.Cpsr();

	_cpsr.N = ((W >> 31) & 0x01) ? true : false;
	_cpsr.Z = ((W >> 30) & 0x01) ? true : false;
	_cpsr.C = ((W >> 29) & 0x01) ? true : false;
	_cpsr.V = ((W >> 28) & 0x01) ? true : false;
	_cpsr.I = ((W >>  7) & 0x01) ? true : false;
	_cpsr.F = ((W >>  6) & 0x01) ? true : false;
	_cpsr.T = ((W >>  5) & 0x01) ? true : false;
	_cpsr.Mode = W & 0x1F;

	return _cpsr;
};
