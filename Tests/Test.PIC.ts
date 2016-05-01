///<reference path="jasmine.d.ts"/>
///<reference path="MockService.ts"/>
///<reference path="../Simulator/Devices/PIC.ts"/>

/**
 * Contains unit-tests for the PIC device.
 */
describe('PIC Tests', () => {
    var pic: ARM.Simulator.Devices.PIC;
    var service: ARM.Simulator.Tests.MockService;
    var irq: (active: boolean) => void = null;
    var fiq: (active: boolean) => void = null;
    var clockRate = 58.9824; // Mhz

    /**
     * Sets up the text fixture. Runs before the first test is executed.
     */
    beforeAll(() => {
        // Hooks JS' setTimeout and setInterval functions, so we can test timing-dependent code.
        jasmine.clock().install();
        jasmine.clock().mockDate();
    });

    /**
     * Tear down the test fixture. Runs after all test methods have been run.
     */
    afterAll(() => {
        jasmine.clock().uninstall();
    });

    /**
     * Runs before each test method is executed.
     */
    beforeEach(() => {
        pic = new ARM.Simulator.Devices.PIC(0, active => {
            if (irq != null)
                irq(active);
        }, active => {
            if (fiq != null)
                fiq(active);
        });
        service = new ARM.Simulator.Tests.MockService(clockRate);
        expect(pic.OnRegister(service)).toBe(true);
    });

    /**
     * Runs after each test method.
     */
    afterEach(() => {
        irq = null;
        fiq = null;
        pic.OnUnregister();
    });

    /**
     * Advances the simulation time by the specified amount of milliseconds.
     * 
     * @param ms
     *  The amount of milliseconds to advance time.
     */
    var tick = (ms: number) => {
        service.Tick(ms);
        jasmine.clock().tick(ms);
    }

    /**
     * Ensures PIC registers contain default values after reset.
     */
    it('Reset Values', () => {
        // Taken from hardware manuals.
        var registers = [
            [0x00, 0x00000000],  // Mode Register
            [0x04, 0x00000000],  // Pending Register
            [0x08, 0x003FFFFF],  // Mask Register
            [0x0C, 0x03020100],  // Priority Register 0
            [0x10, 0x07060504],  // Priority Register 1
            [0x14, 0x0B0A0908],  // Priority Register 2
            [0x18, 0x0F0E0D0C],  // Priority Register 3
            [0x1C, 0x13121110],  // Priority Register 4
            [0x20, 0x00000014],  // Priority Register 5
            [0x24, 0x00000054],  // Offset Register
            [0x28, 0x00000000],  // Pending by Priority Register
            [0x30, 0x00000054],  // FIQ Offset Register
            [0x34, 0x00000054],  // IRQ Offset Register
        ];
        for (var entry of registers) {
            var value = pic.Read(entry[0], ARM.Simulator.DataType.Word);
            expect(value).toBe(entry[1]);
        }
    });

    /**
     * Ensures no interrupts are serviced when the global interrupt disable bit has been set.
     */
    it('Global Interrupt Disable', function () {
        var irqstack = new Array<boolean>();
        irq = a => irqstack.push(a);
        // Clear out mask register so all sources are serviced.
        pic.Write(8, ARM.Simulator.DataType.Word, 0);
        // Trigger an interrupt for source 4, which should drive IRQ out high.
        pic.SetSignal(4, true);
        expect(irqstack.pop()).toBe(true);
        // Acknowledge interrupt by writing 1 to pending register.
        var pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(1 << 4);
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 4);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(0);
        pic.SetSignal(4, false);
        expect(irqstack.pop()).toBe(false);
        // If the global mask bit (bit 21) is 1, no interrupts are serviced. (However, the source
        // pending bit is set whenever the interrupt is generated.)
        pic.Write(8, ARM.Simulator.DataType.Word, (1 << 21));
        // Trigger another interrupt, which should now be ignored.
        pic.SetSignal(12, true);
        expect(irqstack.length).toBe(0);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(1 << 12);
        // After the global mask bit is cleared, the interrupt is serviced.
        pic.Write(8, ARM.Simulator.DataType.Word, 0);
        expect(irqstack.pop()).toBe(true);
    });

    /**
     * Ensures a FIQ is generated for an interrupt source when the respective mode bit has been
     * set.
     */
    it('Fast Interrupt Request (FIQ)', function () {
        var irqstack = new Array<boolean>(),
            fiqstack = new Array<boolean>();
        irq = a => irqstack.push(a);
        fiq = a => fiqstack.push(a);
        // Clear out mask register so all sources are serviced.
        pic.Write(8, ARM.Simulator.DataType.Word, 0);
        // Trigger an interrupt which should drive IRQ out high.
        pic.SetSignal(0, true);
        expect(irqstack.pop()).toBe(true);
        expect(fiqstack.length).toBe(0);
        // Acknowledge interrupt.
        pic.Write(4, ARM.Simulator.DataType.Word, 1);
        expect(irqstack.pop()).toBe(false);
        expect(fiqstack.length).toBe(0);
        // Now configure source 0 mode as FIQ.
        pic.Write(0, ARM.Simulator.DataType.Word, 1);
        // Triggering another interrupt for source 0 should now drive FIQ out high.
        pic.SetSignal(0, true);
        expect(irqstack.length).toBe(0);
        expect(fiqstack.pop()).toBe(true);
        pic.Write(4, ARM.Simulator.DataType.Word, 1);
        expect(irqstack.length).toBe(0);
        expect(fiqstack.pop()).toBe(false);
    });

    /**
     * Ensures multiple interrupting devices drive the PIC output lines as expected.
     */
    it('Multiple Interrupts', function () {
        var irqstack = new Array<boolean>();
        irq = a => irqstack.push(a);
        // Clear out mask register so all sources are serviced.
        pic.Write(8, ARM.Simulator.DataType.Word, 0);
        // Trigger an interrupt which should drive IRQ out high.
        pic.SetSignal(20, true);
        expect(irqstack.pop()).toBe(true);
        var pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(1 << 20);
        // Triggering another interrupt should not invoke callback as IRQ out is already HIGH.
        pic.SetSignal(15, true);
        expect(irqstack.length).toBe(0);
        // But pending bit should be set.
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe((1 << 20) | (1 << 15));
        // Acknowledging only first interrupt should not drive IRQ out LOW.
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 20);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(1 << 15);
        expect(irqstack.length).toBe(0);
        // Acknowledging second pending interrupt should drive IRQ out LOW.
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 15);
        expect(irqstack.pop()).toBe(false);
    });

    /**
     * Ensures masking an interrupt source causes the interrupt not to be serviced anymore.
     */
    it('Mask Interrupt Source', function () {
        var irqstack = new Array<boolean>();
        irq = a => irqstack.push(a);
        // Clear out mask register so all sources are serviced.
        pic.Write(8, ARM.Simulator.DataType.Word, 0);
        // Trigger an interrupt which should drive IRQ out high.
        pic.SetSignal(13, true);
        expect(irqstack.pop()).toBe(true);
        var pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(1 << 13);
        // Acknowledge interrupt.
        pic.Write(4, ARM.Simulator.DataType.Word, pending);
        expect(irqstack.pop()).toBe(false);
        pic.SetSignal(13, false);
        // Mask interrupt source 13.
        pic.Write(8, ARM.Simulator.DataType.Word, 1 << 13);
        // Should no longer be serviced.
        pic.SetSignal(13, true);
        expect(irqstack.length).toBe(0);
        // But other sources should be.
        pic.SetSignal(14, true);
        expect(irqstack.pop()).toBe(true);
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 14);
        pic.SetSignal(14, false);
        expect(irqstack.pop()).toBe(false);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(1 << 13);
        // Unmasking source 13 should drive IRQ out HIGH.
        var mask = pic.Read(8, ARM.Simulator.DataType.Word);
        pic.Write(8, ARM.Simulator.DataType.Word, mask & ~(1 << 13));
        expect(irqstack.pop()).toBe(true);
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 13);
        expect(irqstack.pop()).toBe(false);
        pic.SetSignal(13, false);
    });
});