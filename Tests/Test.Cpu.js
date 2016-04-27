describe('CPU Tests', function () {
    var cpu;
    var read = null;
    var write = null;
    var clockRate = 6.9824;
    var _cpu;
    var initCode = [
        0xea00000c,
        0xea000005,
        0xea000005,
        0xea000005,
        0xea000005,
        0xe1a00000,
        0xea000004,
        0xea000004,
        0xeafffffe,
        0xeafffffe,
        0xeafffffe,
        0xeafffffe,
        0xeafffffe,
        0xeafffffe
    ];
    var resetLabel = 0x38;
    beforeAll(function () {
        jasmine.clock().install();
    });
    afterAll(function () {
        jasmine.clock().uninstall();
    });
    beforeEach(function () {
        cpu = new ARM.Simulator.Cpu(clockRate, function (a, t) {
            if (read != null)
                return read(a, t);
            throw new Error('Could not read data at ' + a);
        }, function (a, t, v) {
            if (write != null)
                write(a, t, v);
            else
                throw new Error('Could not write data at ' + a);
        });
        _cpu = cpu;
    });
    afterEach(function () {
        read = null;
        write = null;
    });
    it('Reset Values', function () {
        expect(_cpu.pc).toBe(0);
        expect(_cpu.state).toBe(ARM.Simulator.CpuState.ARM);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Supervisor);
        expect(_cpu.cpsr.I).toBe(true);
        expect(_cpu.cpsr.F).toBe(true);
    });
    it('Opcode Decoding', function () {
        var pairs = [
            [0xe0904002, _cpu.data],
            [0xe0a15003, _cpu.data],
            [0xe280001a, _cpu.data],
            [0xe1510000, _cpu.data],
            [0xeb000001, _cpu.b_bl],
            [0xe12fff1e, _cpu.bx],
            [0xe3c99003, _cpu.data],
            [0xee070f9a, _cpu.mrc_mcr],
            [0xe59f2038, _cpu.ldr_str],
            [0xe129f000, _cpu.msr],
            [0xee080f17, _cpu.mrc_mcr],
            [0xe59f2038, _cpu.ldr_str],
            [0xe3c33001, _cpu.data],
            [0xee013f10, _cpu.mrc_mcr],
            [0xe1a0f002, _cpu.data],
            [0xe59fc02c, _cpu.ldr_str],
            [0xe3a000f3, _cpu.data],
            [0xe58c001f, _cpu.ldr_str],
            [0xebfffffe, _cpu.b_bl],
            [0xeafffffe, _cpu.b_bl],
            [0xe5901000, _cpu.ldr_str],
            [0xe3510000, _cpu.data],
            [0x1a000000, _cpu.b_bl],
            [0xe5801000, _cpu.ldr_str],
            [0xe5901008, _cpu.ldr_str],
            [0xe590200c, _cpu.ldr_str],
            [0xe4d13001, _cpu.ldr_str],
            [0x00000058, _cpu.data],
            [0x00001341, _cpu.data],
            [0x61750100, _cpu.data],
            [0x01100962, _cpu.data],
            [0x00000009, _cpu.data],
            [0x01180306, _cpu.data]
        ];
        for (var _i = 0, pairs_1 = pairs; _i < pairs_1.length; _i++) {
            var p = pairs_1[_i];
            expect(_cpu.Decode(p[0])).toBe(p[1]);
        }
    });
    it('Reset Instruction Fetch', function () {
        read = function (a) {
            expect(a).toBe(0x00000000);
            return 0;
        };
        cpu.Step();
    });
    it('Undefined Instruction', function () {
        var rom = initCode.concat([
            0xFF000000
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        cpu.Step();
        expect(_cpu.pc).toBe(resetLabel);
        cpu.Step();
        expect(_cpu.pc).toBe(0x00000004);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Undefined);
    });
    it('Software Interrupt', function () {
        var rom = initCode.concat([
            0xef00000f
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        cpu.Step();
        expect(_cpu.pc).toBe(resetLabel);
        cpu.Step();
        expect(_cpu.pc).toBe(0x00000008);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Supervisor);
        var address = _cpu.gpr[14] - 4;
        expect(rom[address / 4]).toBe(0xef00000f);
    });
    it('Data Abort', function () {
        var abortInst = 0xe5901000;
        var rom = initCode.concat([
            0xe51f0000,
            abortInst,
            0x12345678
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            if (a >= rom.length * 4)
                throw new Error('BadAddress');
            return rom[a / 4];
        };
        cpu.Step();
        expect(_cpu.pc).toBe(resetLabel);
        cpu.Step();
        expect(_cpu.gpr[0]).toBe(0x12345678);
        cpu.Step();
        var dataAbortVector = 0x00000010;
        expect(_cpu.pc).toBe(dataAbortVector);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Abort);
        var address = _cpu.gpr[14] - 8;
        expect(rom[address / 4]).toBe(abortInst);
    });
    it('Fast Interrupt Request', function () {
        var rom = initCode.concat([
            0xe10f1000,
            0xe3c11040,
            0xe121f001,
            0xe0a15003,
            0xe280001a,
            0xe1510000
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        cpu.Step();
        expect(_cpu.pc).toBe(resetLabel);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Supervisor);
        expect(_cpu.cpsr.F).toBe(true);
        for (var i = 0; i < 3; i++)
            cpu.Step();
        expect(_cpu.cpsr.F).toBe(false);
        cpu.Step();
        cpu.nFIQ = false;
        var fiqVector = 0x0000001C;
        cpu.Step();
        expect(_cpu.pc).toBe(fiqVector);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.FIQ);
        expect(_cpu.cpsr.F).toBe(true);
        expect(_cpu.cpsr.I).toBe(true);
    });
    it('Interrupt Request', function () {
        var rom = initCode.concat([
            0xe10f1000,
            0xe3c110c0,
            0xe121f001,
            0xe0a15003,
            0xe280001a,
            0xe1510000
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        cpu.Step();
        expect(_cpu.pc).toBe(resetLabel);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Supervisor);
        expect(_cpu.cpsr.I).toBe(true);
        expect(_cpu.cpsr.F).toBe(true);
        for (var i = 0; i < 3; i++)
            cpu.Step();
        expect(_cpu.cpsr.I).toBe(false);
        expect(_cpu.cpsr.F).toBe(false);
        cpu.Step();
        cpu.nIRQ = false;
        var irqVector = 0x00000018;
        cpu.Step();
        expect(_cpu.pc).toBe(irqVector);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.IRQ);
        expect(_cpu.cpsr.I).toBe(true);
        expect(_cpu.cpsr.F).toBe(false);
    });
    it('Mode Switch', function () {
        var rom = initCode.concat([
            0xe10f3000,
            0xe383301f,
            0xe129f003,
            0xe10f3000,
            0xe3c3301f,
            0xe3833010,
            0xe129f003,
            0xe10f3000,
            0xe3c3301f,
            0xe3833013,
            0xe129f003
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        cpu.Step();
        expect(_cpu.pc).toBe(resetLabel);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Supervisor);
        for (var i = 0; i < 3; i++)
            cpu.Step();
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.System);
        for (var i = 0; i < 4; i++)
            cpu.Step();
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.User);
        for (var i = 0; i < 4; i++)
            cpu.Step();
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.User);
    });
    it('Register Banking', function () {
        var sp_svc = 0x87654321;
        var sp_usr = 0x11112222;
        var rom = initCode.concat([
            0xe59fd01c,
            0xe10f3000,
            0xe383301f,
            0xe129f003,
            0xe59fd010,
            0xe10f3000,
            0xe3c3301f,
            0xe3833010,
            0xe129f003,
            0x87654321,
            0x11112222
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        cpu.Step();
        expect(_cpu.pc).toBe(resetLabel);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Supervisor);
        cpu.Step();
        expect(_cpu.gpr[13]).toBe(sp_svc);
        for (var i = 0; i < 3; i++)
            cpu.Step();
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.System);
        expect(_cpu.gpr[13]).not.toBe(sp_svc);
        cpu.Step();
        expect(_cpu.gpr[13]).toBe(sp_usr);
        for (var i = 0; i < 4; i++)
            cpu.Step();
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.User);
        expect(_cpu.gpr[13]).toBe(sp_usr);
    });
    it('Addition Overflow', function () {
        var rom = initCode.concat([
            0xe3e01000,
            0xe3a02001,
            0xe0910002
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        cpu.Step();
        expect(_cpu.pc).toBe(resetLabel);
        for (var i = 0; i < 3; i++)
            cpu.Step();
        expect(_cpu.cpsr.N).toBe(false);
        expect(_cpu.cpsr.Z).toBe(true);
        expect(_cpu.cpsr.C).toBe(true);
        expect(_cpu.cpsr.V).toBe(false);
    });
    it('Integer Arithmetic #1', function () {
        var rom = initCode.concat([
            0xe3a00007,
            0xe3a01000,
            0xe2811001,
            0xe2104001,
            0x0a000002,
            0xe0800080,
            0xe2800001,
            0xeafffff9,
            0xe1a000c0,
            0xe2507001,
            0x1afffff6,
            0xe51fa000,
            0xe58a0000,
            0x12345678
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        var stopRunning = false;
        write = function (a) {
            expect(a).toBe(0x12345678);
            stopRunning = true;
        };
        while (!stopRunning)
            cpu.Step();
        var expectedIterations = 16;
        expect(_cpu.gpr[1]).toBe(expectedIterations);
    });
    it('Integer Arithmetic #2', function () {
        var rom = initCode.concat([
            0xe59f0034,
            0xe3a01000,
            0xe3a02419,
            0xe3822899,
            0xe3822c99,
            0xe382209a,
            0xe3a0300a,
            0xe0854290,
            0xe0864395,
            0xe0404004,
            0xe0811004,
            0xe1b00005,
            0x1afffff9,
            0xe51fa000,
            0xe58a0000,
            0x12345678
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        var stopRunning = false;
        write = function (a) {
            expect(a).toBe(0x12345678);
            stopRunning = true;
        };
        while (!stopRunning)
            cpu.Step();
        var expectedResult = 45;
        expect(_cpu.gpr[1]).toBe(expectedResult);
    });
    it('Branch and Link', function () {
        var rom = initCode.concat([
            0xe3a0000a,
            0xe3a01003,
            0xeb000002,
            0xe3a02018,
            0xe59f3008,
            0xe5830000,
            0xe0800001,
            0xe12fff1e,
            0x12345678
        ]);
        read = function (a) {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        var stopRunning = false;
        write = function (a) {
            expect(a).toBe(0x12345678);
            stopRunning = true;
        };
        while (!stopRunning)
            cpu.Step();
        var expectedResult = 13;
        expect(_cpu.gpr[0]).toBe(expectedResult);
        expect(_cpu.gpr[2]).toBe(24);
    });
});
//# sourceMappingURL=Test.Cpu.js.map