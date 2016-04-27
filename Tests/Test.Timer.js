describe('Timer Tests', function () {
    var timer;
    var service;
    var interrupt = null;
    var clockRate = 58.9824;
    beforeAll(function () {
        jasmine.clock().install();
        jasmine.clock().mockDate();
    });
    afterAll(function () {
        jasmine.clock().uninstall();
    });
    beforeEach(function () {
        timer = new ARM.Simulator.Devices.Timer(0, function (active) {
            if (interrupt != null && active)
                interrupt(active);
        });
        service = new ARM.Simulator.Tests.MockService(clockRate);
        expect(timer.OnRegister(service)).toBe(true);
    });
    afterEach(function () {
        interrupt = null;
        timer.OnUnregister();
    });
    var tick = function (ms) {
        service.Tick(ms);
        jasmine.clock().tick(ms);
    };
    it('Reset Values', function () {
        var registers = [
            [0x00, 0x00],
            [0x04, 0x00],
            [0x08, 0x00]
        ];
        for (var _i = 0, registers_1 = registers; _i < registers_1.length; _i++) {
            var entry = registers_1[_i];
            var value = timer.Read(entry[0], ARM.Simulator.DataType.Word);
            expect(value).toBe(entry[1]);
        }
    });
    it('Overflow Interrupt', function () {
        var numOverflow = 0;
        interrupt = function () {
            var mode = timer.Read(0, ARM.Simulator.DataType.Word);
            expect(mode & 0xC00).toBe(0x800);
            timer.Write(0, ARM.Simulator.DataType.Word, mode & ~0x800);
            numOverflow++;
        };
        timer.Write(0, ARM.Simulator.DataType.Word, 0x280);
        tick(1000);
        expect(numOverflow).toBe(900);
    });
    it('Compare Interrupt', function () {
        var numInterrupts = 0;
        interrupt = function () {
            var mode = timer.Read(0, ARM.Simulator.DataType.Word);
            expect(mode & 0xC00).toBe(0x400);
            timer.Write(0, ARM.Simulator.DataType.Word, mode & ~0x400);
            numInterrupts++;
        };
        var countUpTo = (1 << 12);
        timer.Write(8, ARM.Simulator.DataType.Word, countUpTo);
        timer.Write(0, ARM.Simulator.DataType.Word, 0x1C2);
        tick(1000);
        expect(numInterrupts).toBe(56);
    });
    it('Stop and Continue', function () {
        expect(timer.Read(4, ARM.Simulator.DataType.Word)).toBe(0);
        timer.Write(0, ARM.Simulator.DataType.Word, 0x82);
        tick(1);
        var count = timer.Read(4, ARM.Simulator.DataType.Word);
        expect(count).toBe(230);
        var mode = timer.Read(0, ARM.Simulator.DataType.Word);
        timer.Write(0, ARM.Simulator.DataType.Word, mode & ~(1 << 7));
        tick(100);
        expect(timer.Read(4, ARM.Simulator.DataType.Word)).toBe(count);
        timer.Write(0, ARM.Simulator.DataType.Word, mode);
        expect(timer.Read(4, ARM.Simulator.DataType.Word)).toBe(count);
        tick(1);
        expect(timer.Read(4, ARM.Simulator.DataType.Word)).toBeGreaterThan(count);
    });
});
//# sourceMappingURL=Test.Timer.js.map