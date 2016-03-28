///<reference path="jasmine.d.ts"/>
///<reference path="MockService.ts"/>
///<reference path="../Simulator/Devices/DS1307.ts"/>

/**
 * Contains unit-tests for the DS1307 device.
 */
describe('DS1307 Tests', () => {
    var rtc: ARM.Simulator.Devices.DS1307;
    var service: ARM.Simulator.Tests.MockService;

    /**
     * Sets up the text fixture. Runs before the first test is executed.
     */
    beforeAll(() => {
        // Hooks JS' setTimeout and setInterval functions, so we can test timing-dependent code.
        jasmine.clock().install();
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
        rtc = new ARM.Simulator.Devices.DS1307(0, new Date());
        service = new ARM.Simulator.Tests.MockService();
        expect(rtc.OnRegister(service)).toBe(true);
    });

    /**
     * Runs after each test method.
     */
    afterEach(() => {
        rtc.OnUnregister();
    });

    /**
     * Advances the simulation time by the specified amount of milliseconds.
     * 
     * @param ms
     *  The amount of milliseconds to advance time.
     */
    var tick = (ms: number) => {
        jasmine.clock().tick(ms);
    }

    /**
     * Ensures the specified event has been raised.
     * 
     * @param event
     *  The name of the event.
     * @param properties
     *  A set of expected event properties.
     * @param numTimes
     *  The number of times the event is expected to have been raised.
     */
    var expectEvent = (event: string, properties: any = null, numTimes = 1) => {
        for (let i = 0; i < numTimes; i++) {
            expect(service.RaisedEvents.length).toBeGreaterThan(0);
            var ev = service.RaisedEvents.pop();
            expect(ev[0]).toBe(event);
            if (properties != null) {
                for (var key in properties) {
                    if (!properties.hasOwnProperty(key))
                        continue;
                    expect(ev[1][key]).toBeDefined();
                    expect(ev[1][key]).toBe(properties[key]);
                }
            }
        }
    }

    /**
     * Ensures converting from and to BCD works as expected.
     */
    it('BCD Conversion', () => {
        var pairs = [
            [23, 0x23],
            [18, 0x18],
            [ 0, 0x00],
            [ 9, 0x09],
            [10, 0x10]
        ];        
        for (var p of pairs) {
            expect(ARM.Simulator.Devices.DS1307.ToBCD(p[0])).toBe(p[1]);
            expect(ARM.Simulator.Devices.DS1307.FromBCD(p[1])).toBe(p[0]);
        }
    });

    /**
     * Tests for periodic generation of clock tick events.
     */
    it('Tick Tock', () => {
        expect(service.RaisedEvents.length).toBe(0);
        tick(5210);
        expectEvent('DS1307.Tick', null, 5);
    });

    /**
     * Ensures enabling and disabling the RTC's oscillator works as expected.
     */
    it('Oscillator Enable/Disable', () => {
        // Oscillator is enabled by default.
        expect(service.RaisedEvents.length).toBe(0);
        tick(43284);
        expectEvent('DS1307.Tick', null, 43);
        // Disable oscillator by setting Bit 7 of Seconds register.
        var secondsRegister = rtc.Read(0, ARM.Simulator.DataType.Byte);
        secondsRegister |= (1 << 7);
        rtc.Write(0, ARM.Simulator.DataType.Byte, secondsRegister);
        // Should generate a memory write event.
        expectEvent('DS1307.DataWrite');
        // No new clock ticks should be generated from this point onwards.
        expect(service.RaisedEvents.length).toBe(0);
        tick(67801);
        expect(service.RaisedEvents.length).toBe(0);
        // Enable oscillator again.
        secondsRegister &= ~(1 << 7);
        rtc.Write(0, ARM.Simulator.DataType.Byte, secondsRegister);
        tick(92549);
        // 92 Ticks + 1 memory write event.
        expectEvent('DS1307.Tick', null, 92);
        expectEvent('DS1307.DataWrite');
    });

    /**
     * Ensures setting the RTC's clock registers works as expected.
     */
    it('Set/Get Time', () => {
        // Pre-calculated BCD values for Thursday, December 17, 2015 03:24:00
        var values = [
            0x00, // Seconds
            0x24, // Minutes
            0x03, // Hours,
            0x05, // Thursday
            0x17, // Date
            0x12, // Month
            0x15  // Year
        ];
        for (let i = 0; i < values.length; i++)
            rtc.Write(i, ARM.Simulator.DataType.Byte, values[i]);
        expectEvent('DS1307.DataWrite', null, values.length);
        // Let time advance 36 hours, reading out RTC time should then yield:
        // Friday, December 18, 2015 15:24:00
        tick(1000 * 60 * 60 * 36);
        var expected = [0x00, 0x24, 0x15, 0x06, 0x18, 0x12, 0x15];
        for (let i = 0; i < expected.length; i++)
            expect(rtc.Read(i, ARM.Simulator.DataType.Byte)).toBe(expected[i]);
    });

    /**
     * Ensures the RTC's 12-Hour Mode works as expected.
     */
    it('12-Hour Mode', () => {
        // Pre-calculated BCD values for Sunday, September 28, 2014 2:51:12 PM
        var values = [
            0x12, // Seconds
            0x51, // Minutes
            // Hours, Bit 6 enables 12-Hour Mode, Bit 5 sets PM.
            0x02 | (1 << 6) | (1 << 5),
            0x01, // Sunday
            0x28, // Date
            0x09, // Month
            0x14  // Year
        ];
        for (let i = 0; i < values.length; i++)
            rtc.Write(i, ARM.Simulator.DataType.Byte, values[i]);
        expectEvent('DS1307.DataWrite', null, values.length);
        // Let time advance 20 hours, reading out RTC time should then yield:
        // Monday, September 29, 2014 10:51:12 AM
        tick(1000 * 60 * 60 * 20);
        var expected = [0x12, 0x51,
            // We expect Bit 6 of Hours register to be set (12-Hour Mode) and Bit 5 cleared (AM).
            0x10 | (1 << 6),
            0x02, 0x29, 0x09, 0x14];
        for (let i = 0; i < expected.length; i++)
            expect(rtc.Read(i, ARM.Simulator.DataType.Byte)).toBe(expected[i]);        
        // Let time advance another 2 hours, reading out RTC hours should then yield:
        // 12 PM
        tick(1000 * 60 * 60 * 2);
        var expectedHours = 0x12 | (1 << 6) | (1 << 5);
        expect(rtc.Read(2, ARM.Simulator.DataType.Byte)).toBe(expectedHours);
    });
});