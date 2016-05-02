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
    it('Interrupt Priorities #1', function () {
        var base = 0x0C;
        var priorities = [
            0x00000014, 0x13121110, 0x0F0E0D0C, 0x0B0A0908, 0x07060504, 0x03020100
        ];
        for (var i = 0; i < priorities.length; i++) {
            expect(pic.Read(base + (priorities.length - 1 - i) * 4, ARM.Simulator.DataType.Word)).toBe(priorities[i]);
        }
        for (var i = 0; i < priorities.length; i++)
            pic.Write(base + i * 4, ARM.Simulator.DataType.Word, priorities[i]);
        for (var i = 0; i < priorities.length; i++)
            expect(pic.Read(base + i * 4, ARM.Simulator.DataType.Word)).toBe(priorities[i]);
    });
    it('Interrupt Priorities #2', function () {
        var irqstack = new Array();
        irq = function (a) { return irqstack.push(a); };
        var base = 0x0C;
        pic.Write(8, ARM.Simulator.DataType.Word, 0);
        pic.Write(base + 0x14, ARM.Simulator.DataType.Word, 0x00000004);
        pic.Write(base + 0x08, ARM.Simulator.DataType.Word, 0x000C0000);
        pic.Write(base + 0x00, ARM.Simulator.DataType.Word, 0x00000014);
        pic.SetSignal(12, true);
        var pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(1 << 12);
        var intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(12 << 2);
        var pendingByPriority = pic.Read(0x28, ARM.Simulator.DataType.Word);
        expect(pendingByPriority).toBe(1 << 10);
        pic.SetSignal(4, true);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe((1 << 12) | (1 << 4));
        intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(4 << 2);
        pendingByPriority = pic.Read(0x28, ARM.Simulator.DataType.Word);
        expect(pendingByPriority).toBe((1 << 10) | (1 << 20));
        pic.SetSignal(20, true);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe((1 << 12) | (1 << 4) | (1 << 20));
        intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(4 << 2);
        pendingByPriority = pic.Read(0x28, ARM.Simulator.DataType.Word);
        expect(pendingByPriority).toBe((1 << 10) | (1 << 20) | (1 << 0));
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 4);
        intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(12 << 2);
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 12);
        intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(20 << 2);
        expect(irqstack.length).toBe(1);
        expect(irqstack.pop()).toBe(true);
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 20);
        intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(0x54);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(0);
        pendingByPriority = pic.Read(0x28, ARM.Simulator.DataType.Word);
        expect(pendingByPriority).toBe(0);
        expect(irqstack.pop()).toBe(false);
    });
    it('Highest Priority IRQ/FIQ Interrupt', function () {
        var irqstack = new Array();
        var fiqstack = new Array();
        irq = function (a) { return irqstack.push(a); };
        fiq = function (a) { return fiqstack.push(a); };
        var base = 0x0C;
        pic.Write(8, ARM.Simulator.DataType.Word, 0);
        pic.Write(base + 0x10, ARM.Simulator.DataType.Word, 0x000E0000);
        pic.Write(base + 0x0C, ARM.Simulator.DataType.Word, 0x01000000);
        pic.Write(base + 0x04, ARM.Simulator.DataType.Word, 0x00000007);
        pic.Write(0, ARM.Simulator.DataType.Word, (1 << 14) | (1 << 7));
        pic.SetSignal(7, true);
        expect(fiqstack.pop()).toBe(true);
        var intoset_irq = pic.Read(0x34, ARM.Simulator.DataType.Word);
        expect(intoset_irq).toBe(0x54);
        var intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(7 << 2);
        var intoset_fiq = pic.Read(0x30, ARM.Simulator.DataType.Word);
        expect(intoset_fiq).toBe(7 << 2);
        pic.SetSignal(1, true);
        expect(irqstack.pop()).toBe(true);
        intoset_irq = pic.Read(0x34, ARM.Simulator.DataType.Word);
        expect(intoset_irq).toBe(1 << 2);
        intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(1 << 2);
        pic.SetSignal(14, true);
        intoset_fiq = pic.Read(0x30, ARM.Simulator.DataType.Word);
        expect(intoset_fiq).toBe(14 << 2);
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 1);
        intoset_irq = pic.Read(0x34, ARM.Simulator.DataType.Word);
        expect(intoset_irq).toBe(0x54);
        expect(irqstack.pop()).toBe(false);
        expect(fiqstack.length).toBe(0);
        pic.Write(4, ARM.Simulator.DataType.Word, (1 << 7) | (1 << 14));
        intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(0x54);
        intoset_fiq = pic.Read(0x30, ARM.Simulator.DataType.Word);
        expect(intoset_fiq).toBe(0x54);
        expect(fiqstack.pop()).toBe(false);
    });
    it('Pending Test Register', function () {
        var pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(0);
        var pendingByPriority = pic.Read(0x28, ARM.Simulator.DataType.Word);
        expect(pendingByPriority).toBe(0);
        var base = 0x0C;
        pic.Write(base + 0x10, ARM.Simulator.DataType.Word, 0x04001400);
        pic.Write(base + 0x04, ARM.Simulator.DataType.Word, 0x000D0000);
        pic.Write(base + 0x00, ARM.Simulator.DataType.Word, 0x00000E00);
        pic.Write(0x2C, ARM.Simulator.DataType.Word, (1 << 4) | (1 << 13) | (1 << 14) | (1 << 20));
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe((1 << 4) | (1 << 13) | (1 << 14) | (1 << 20));
        pendingByPriority = pic.Read(0x28, ARM.Simulator.DataType.Word);
        expect(pendingByPriority).toBe((1 << 19) | (1 << 6) | (1 << 1) | (1 << 17));
    });
});
//# sourceMappingURL=Test.PIC.js.map