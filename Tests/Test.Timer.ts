///<reference path="jasmine.d.ts"/>
///<reference path="MockService.ts"/>
///<reference path="../Simulator/Devices/Timer.ts"/>

/**
 * Contains unit-tests for the Timer device.
 */
describe('Timer Tests', () => {
    var timer: ARM.Simulator.Devices.Timer;
    var service: ARM.Simulator.Tests.MockService;
    var interrupt: (active: boolean) => void = null;
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
        timer = new ARM.Simulator.Devices.Timer(0, active => {
            if (interrupt != null && active)
                interrupt(active);
        });
        service = new ARM.Simulator.Tests.MockService(clockRate);
        expect(timer.OnRegister(service)).toBe(true);
    });

    /**
     * Runs after each test method.
     */
    afterEach(() => {
        interrupt = null;
        timer.OnUnregister();
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
     * Ensures timer registers contain default values after reset.
     */
    it('Reset Values', () => {
        var registers = [
            // MODE register.
            [0x00, 0x00],
            // COUNT register.
            [0x04, 0x00],
            // COMP register.
            [0x08, 0x00]
        ];
        for (var entry of registers) {
            var value = timer.Read(entry[0], ARM.Simulator.DataType.Word);
            expect(value).toBe(entry[1]);
        }
    });

    /**
     * Ensures an interrupt is generated when the timer's counter register overflows.
     */
    it('Overflow Interrupt', () => {
        var numOverflow = 0;
        interrupt = () => {
            // Interrupt should be an overflow interrupt.
            var mode = timer.Read(0, ARM.Simulator.DataType.Word);
            expect(mode & 0xC00).toBe(0x800);
            // Acknowledge interrupt.
            timer.Write(0, ARM.Simulator.DataType.Word, mode & ~0x800);
            numOverflow++;
        };
        // Enable timer:
        //  Clock selection CPU Clock
        //  No Zero-Return
        //  Generate Overflow Interrupt
        timer.Write(0, ARM.Simulator.DataType.Word, 0x280);
        tick(1000);
        // Clock rate = 58,982,400 ticks per second
        // Counter reg overflows each 2^16 ticks => 900 times a second.
        expect(numOverflow).toBe(900);
    });

    /**
     * Ensures an interrupt is generated when the timer's counter register equals the timer's
     * compare register.
     */
    it('Compare Interrupt', () => {
        var numInterrupts = 0;
        interrupt = () => {
            // Interrupt should be a compare interrupt.
            var mode = timer.Read(0, ARM.Simulator.DataType.Word);
            expect(mode & 0xC00).toBe(0x400);
            // Acknowledge interrupt.
            timer.Write(0, ARM.Simulator.DataType.Word, mode & ~0x400);
            numInterrupts++;
        };
        // Configure comparison register.
        var countUpTo = (1 << 12);
        timer.Write(8, ARM.Simulator.DataType.Word, countUpTo);
        // Enable timer:
        //  Clock selection: 1/256 of CPU Clock
        //  Zero-Return
        //  Generate Compare Interrupt
        timer.Write(0, ARM.Simulator.DataType.Word, 0x1C2);
        // Clock rate = 58,982,400 ticks per second
        // Timer ticks every (58,982,400 / 256) = 230400 cycles.
        // 230400 / (1 << 12) = ~56 times per second.
        tick(1000);
        expect(numInterrupts).toBe(56);
    });

    /**
     * Ensures enabling and disabling timers works as expected.
     */
    it('Stop and Continue', () => {
        expect(timer.Read(4, ARM.Simulator.DataType.Word)).toBe(0);
        // Enable timer:
        //  Clock selection: 1/256 of CPU Clock
        //  No Zero-Return
        //  No Interrupts
        timer.Write(0, ARM.Simulator.DataType.Word, 0x82);
        tick(1);
        var count = timer.Read(4, ARM.Simulator.DataType.Word);
        expect(count).toBe(230);
        // Stop timer by clearing the Count-Enable bit.
        var mode = timer.Read(0, ARM.Simulator.DataType.Word);
        timer.Write(0, ARM.Simulator.DataType.Word, mode & ~(1 << 7));
        // Counter register shouldn't be increased anymore.
        tick(100);
        expect(timer.Read(4, ARM.Simulator.DataType.Word)).toBe(count);        
        // Start timer again.        
        timer.Write(0, ARM.Simulator.DataType.Word, mode);
        expect(timer.Read(4, ARM.Simulator.DataType.Word)).toBe(count);        
        tick(1);
        expect(timer.Read(4, ARM.Simulator.DataType.Word)).toBeGreaterThan(count);
    });
});