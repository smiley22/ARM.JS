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

    /**
     * Ensures the interrupt priority registers can be read and written as expected.
     */
    it('Interrupt Priorities #1', function () {
        var base = 0x0C; // The 6 priority registers are offset at 0x0C.
        var priorities = [
            0x00000014, 0x13121110, 0x0F0E0D0C, 0x0B0A0908, 0x07060504, 0x03020100
        ];
        for (var i = 0; i < priorities.length; i++) {
            // Default value after reset.
            expect(pic.Read(base + (priorities.length - 1 - i) * 4,
                ARM.Simulator.DataType.Word)).toBe(priorities[i]);
        }
        for (var i = 0; i < priorities.length; i++)
            pic.Write(base + i * 4, ARM.Simulator.DataType.Word, priorities[i]);
        for (var i = 0; i < priorities.length; i++)
            expect(pic.Read(base + i * 4, ARM.Simulator.DataType.Word)).toBe(priorities[i]);
    });

    /**
     * Ensures the configured interrupt priorities are honoured by the PIC as expected when
     * multiple interrupts are pending simultaneously.
     */
    it('Interrupt Priorities #2', function () {
        var irqstack = new Array<boolean>();
        irq = a => irqstack.push(a);
        var base = 0x0C;
        // Clear out mask register so all sources are serviced.
        pic.Write(8, ARM.Simulator.DataType.Word, 0);
        // Setup: - Interrupt Source  4 has priority 20.
        //        - Interrupt Source 12 has priority 10.
        //        - Interrupt Source 20 has priority 0.
        pic.Write(base + 0x14, ARM.Simulator.DataType.Word, 0x00000004);
        pic.Write(base + 0x08, ARM.Simulator.DataType.Word, 0x000C0000);
        pic.Write(base + 0x00, ARM.Simulator.DataType.Word, 0x00000014);
        // Source 12 triggers an interrupt.
        pic.SetSignal(12, true);
        var pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(1 << 12);
        // Reading INTOFFSET should yield 12 << 2 = 48.
        var intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(12 << 2);
        // Reading the pending-by-priority register should yield a word with bit position 10 set.
        var pendingByPriority = pic.Read(0x28, ARM.Simulator.DataType.Word);
        expect(pendingByPriority).toBe(1 << 10);
        // Source 4 triggers an interrupt.
        pic.SetSignal(4, true);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe((1 << 12) | (1 << 4));
        // INTOFFSET should still yield 4 << 2 because source 4 has a higher priority than 12.
        intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(4 << 2);
        pendingByPriority = pic.Read(0x28, ARM.Simulator.DataType.Word);
        expect(pendingByPriority).toBe((1 << 10) | (1 << 20));
        // Source 20 triggers an interrupt.
        pic.SetSignal(20, true);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe((1 << 12) | (1 << 4) | (1 << 20));
        intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(4 << 2);
        pendingByPriority = pic.Read(0x28, ARM.Simulator.DataType.Word);
        expect(pendingByPriority).toBe((1 << 10) | (1 << 20) | (1 << 0));
        // Acknowledge 4, INTOFFSET should then return 12 << 2 again.
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 4);
        intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(12 << 2);
        // Acknowledge 12, INTOFFSET should then return 20 << 2.
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 12);
        intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(20 << 2);
        // All this time IRQ out should have been asserted.
        expect(irqstack.length).toBe(1);
        expect(irqstack.pop()).toBe(true);
        // Acknowledge 20, at which point INTOFFSET should return 0x54. IRQ out should go LOW.
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 20);
        intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(0x54);
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(0);
        pendingByPriority = pic.Read(0x28, ARM.Simulator.DataType.Word);
        expect(pendingByPriority).toBe(0);
        expect(irqstack.pop()).toBe(false);
    });

    /**
     * Ensures the INTOSET_IRQ and INTOSET_FIQ registers work as expected.
     */
    it('Highest Priority IRQ/FIQ Interrupt', function () {
        var irqstack = new Array<boolean>();
        var fiqstack = new Array<boolean>();
        irq = a => irqstack.push(a);
        fiq = a => fiqstack.push(a);
        var base = 0x0C;
        // Clear out mask register so all sources are serviced.
        pic.Write(8, ARM.Simulator.DataType.Word, 0);
        // Setup: - Interrupt Source 14 has priority 18 and is FIQ.
        //        - Interrupt Source  1 has priority 15 and is IRQ.
        //        - Interrupt Source  7 has priority  4 and is FIQ.
        pic.Write(base + 0x10, ARM.Simulator.DataType.Word, 0x000E0000);
        pic.Write(base + 0x0C, ARM.Simulator.DataType.Word, 0x01000000);
        pic.Write(base + 0x04, ARM.Simulator.DataType.Word, 0x00000007);
        // Configure modes.
        pic.Write(0, ARM.Simulator.DataType.Word, (1 << 14) | (1 << 7));
        // Source 7 triggers an interrupt.
        pic.SetSignal(7, true);
        expect(fiqstack.pop()).toBe(true);
        // Reading INTOSET_IRQ should return 0x00000054.
        var intoset_irq = pic.Read(0x34, ARM.Simulator.DataType.Word);
        expect(intoset_irq).toBe(0x54);
        // INTOSET_FIQ and INTOFFSET should both return 7 << 2.
        var intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(7 << 2);
        var intoset_fiq = pic.Read(0x30, ARM.Simulator.DataType.Word);
        expect(intoset_fiq).toBe(7 << 2);
        // Source 1 triggers an interrupt.
        pic.SetSignal(1, true);
        expect(irqstack.pop()).toBe(true);
        // Reading INTOSET_IRQ and INTOFFSET should now return 1 << 2.
        intoset_irq = pic.Read(0x34, ARM.Simulator.DataType.Word);
        expect(intoset_irq).toBe(1 << 2);
        intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(1 << 2);
        // Source 14 triggers an interrupt.
        pic.SetSignal(14, true);
        intoset_fiq = pic.Read(0x30, ARM.Simulator.DataType.Word);
        expect(intoset_fiq).toBe(14 << 2);
        // Acknowledging Source 1 and then reading INTOSET_IRQ should return 0x54.
        pic.Write(4, ARM.Simulator.DataType.Word, 1 << 1);
        intoset_irq = pic.Read(0x34, ARM.Simulator.DataType.Word);
        expect(intoset_irq).toBe(0x54);
        expect(irqstack.pop()).toBe(false); // IRQ out should go LOW.
        expect(fiqstack.length).toBe(0); // FIQ out should still be HIGH.
        // Acknowledge 7 and 14.
        pic.Write(4, ARM.Simulator.DataType.Word, (1 << 7) | (1 << 14));
        intOffset = pic.Read(0x24, ARM.Simulator.DataType.Word);
        expect(intOffset).toBe(0x54);
        intoset_fiq = pic.Read(0x30, ARM.Simulator.DataType.Word);
        expect(intoset_fiq).toBe(0x54);
        expect(fiqstack.pop()).toBe(false);
    });

    /**
     * Ensures writing to the Pending Test Register has the desired effect.
     */
    it('Pending Test Register', function () {
        // Manual: For INTPND, the same bit position is updated with the new coming data. For
        //         INTPNDPRI, the mapping bit position by INTPRIn registers is updated with the
        //         new coming data to keep with the contents of the INTPND register.
        var pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe(0);
        var pendingByPriority = pic.Read(0x28, ARM.Simulator.DataType.Word);
        expect(pendingByPriority).toBe(0);
        // Configure some random priorities.
        // Source 4  -> Priority 19
        // Source 13 -> Priority  6
        // Source 14 -> Priority  1
        // Source 20 -> Priority 17
        var base = 0x0C;
        pic.Write(base + 0x10, ARM.Simulator.DataType.Word, 0x04001400);
        pic.Write(base + 0x04, ARM.Simulator.DataType.Word, 0x000D0000);
        pic.Write(base + 0x00, ARM.Simulator.DataType.Word, 0x00000E00);
        // Writing Pending Test Register should echo into pending and pendingByPriority.
        pic.Write(0x2C, ARM.Simulator.DataType.Word, (1 << 4) | (1 << 13) | (1 << 14) | (1 << 20));
        pending = pic.Read(4, ARM.Simulator.DataType.Word);
        expect(pending).toBe((1 << 4) | (1 << 13) | (1 << 14) | (1 << 20));
        pendingByPriority = pic.Read(0x28, ARM.Simulator.DataType.Word);
        expect(pendingByPriority).toBe((1 << 19) | (1 << 6) | (1 << 1) | (1 << 17));      
    });
});