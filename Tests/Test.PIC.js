describe('PIC Tests', function () {
    var pic;
    var service;
    var irq = null;
    var fiq = null;
    var clockRate = 58.9824;
    beforeAll(function () {
        jasmine.clock().install();
        jasmine.clock().mockDate();
    });
    afterAll(function () {
        jasmine.clock().uninstall();
    });
    beforeEach(function () {
        pic = new ARM.Simulator.Devices.PIC(0, function (active) {
            if (irq != null)
                irq(active);
        }, function (active) {
            if (fiq != null)
                fiq(active);
        });
        service = new ARM.Simulator.Tests.MockService(clockRate);
        expect(pic.OnRegister(service)).toBe(true);
    });
    afterEach(function () {
        irq = null;
        fiq = null;
        pic.OnUnregister();
    });
    var tick = function (ms) {
        service.Tick(ms);
        jasmine.clock().tick(ms);
    };
    it('Reset Values', function () {
        var registers = [
            [0x00, 0x00000000],
            [0x04, 0x00000000],
            [0x08, 0x003FFFFF],
            [0x0C, 0x03020100],
            [0x10, 0x07060504],
            [0x14, 0x0B0A0908],
            [0x18, 0x0F0E0D0C],
            [0x1C, 0x13121110],
            [0x20, 0x00000014],
            [0x24, 0x00000054],
            [0x28, 0x00000000],
            [0x30, 0x00000054],
            [0x34, 0x00000054],
        ];
        for (var _i = 0, registers_1 = registers; _i < registers_1.length; _i++) {
            var entry = registers_1[_i];
            var value = pic.Read(entry[0], ARM.Simulator.DataType.Word);
            expect(value).toBe(entry[1]);
        }
    });
    it('Global Interrupt Disable', function () {
        var irqstack = new Array();
        irq = function (a) { return irqstack.push(a); };
        pic.Write(8, ARM.Simulator.DataType.Word, 0);
        pic.SetSignal(4, true);
        expect(irqstack.pop()).toBe(true);
        var pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(1 << 4);
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 4);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(0);
        pic.SetSignal(4, false);
        expect(irqstack.pop()).toBe(false);
        pic.Write(8, ARM.Simulator.DataType.Word, (1 << 21));
        pic.SetSignal(12, true);
        expect(irqstack.length).toBe(0);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(1 << 12);
        pic.Write(8, ARM.Simulator.DataType.Word, 0);
        expect(irqstack.pop()).toBe(true);
    });
    it('Fast Interrupt Request (FIQ)', function () {
        var irqstack = new Array(), fiqstack = new Array();
        irq = function (a) { return irqstack.push(a); };
        fiq = function (a) { return fiqstack.push(a); };
        pic.Write(8, ARM.Simulator.DataType.Word, 0);
        pic.SetSignal(0, true);
        expect(irqstack.pop()).toBe(true);
        expect(fiqstack.length).toBe(0);
        pic.Write(4, ARM.Simulator.DataType.Word, 1);
        expect(irqstack.pop()).toBe(false);
        expect(fiqstack.length).toBe(0);
        pic.Write(0, ARM.Simulator.DataType.Word, 1);
        pic.SetSignal(0, true);
        expect(irqstack.length).toBe(0);
        expect(fiqstack.pop()).toBe(true);
        pic.Write(4, ARM.Simulator.DataType.Word, 1);
        expect(irqstack.length).toBe(0);
        expect(fiqstack.pop()).toBe(false);
    });
    it('Multiple Interrupts', function () {
        var irqstack = new Array();
        irq = function (a) { return irqstack.push(a); };
        pic.Write(8, ARM.Simulator.DataType.Word, 0);
        pic.SetSignal(20, true);
        expect(irqstack.pop()).toBe(true);
        var pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(1 << 20);
        pic.SetSignal(15, true);
        expect(irqstack.length).toBe(0);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe((1 << 20) | (1 << 15));
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 20);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(1 << 15);
        expect(irqstack.length).toBe(0);
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 15);
        expect(irqstack.pop()).toBe(false);
    });
    it('Mask Interrupt Source', function () {
        var irqstack = new Array();
        irq = function (a) { return irqstack.push(a); };
        pic.Write(8, ARM.Simulator.DataType.Word, 0);
        pic.SetSignal(13, true);
        expect(irqstack.pop()).toBe(true);
        var pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(1 << 13);
        pic.Write(4, ARM.Simulator.DataType.Word, pending);
        expect(irqstack.pop()).toBe(false);
        pic.SetSignal(13, false);
        pic.Write(8, ARM.Simulator.DataType.Word, 1 << 13);
        pic.SetSignal(13, true);
        expect(irqstack.length).toBe(0);
        pic.SetSignal(14, true);
        expect(irqstack.pop()).toBe(true);
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 14);
        pic.SetSignal(14, false);
        expect(irqstack.pop()).toBe(false);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(1 << 13);
        var mask = pic.Read(8, ARM.Simulator.DataType.Word);
        pic.Write(8, ARM.Simulator.DataType.Word, mask & ~(1 << 13));
        expect(irqstack.pop()).toBe(true);
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 13);
        expect(irqstack.pop()).toBe(false);
        pic.SetSignal(13, false);
    });
});
//# sourceMappingURL=Test.PIC.js.map