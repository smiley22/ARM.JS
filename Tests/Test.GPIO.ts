///<reference path="jasmine.d.ts"/>
///<reference path="MockService.ts"/>
///<reference path="../Simulator/Devices/GPIO.ts"/>

/**
 * Contains unit-tests for the General-Purpose Input/Output device.
 */
describe('GPIO Tests', () => {
    var gpio: ARM.Simulator.Devices.GPIO;
    var service: ARM.Simulator.Tests.MockService;
    var read: (port: number) => number = null;
    var write: (port: number, value: number, set: boolean, clear: boolean,
        dir: number) => void = null;

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
        gpio = new ARM.Simulator.Devices.GPIO(0, 2, (p) => {
            if (read)
                return read(p);
            return 0;
        }, (p, v, s, c, d) => {
            if (write)
                write(p, v, s, c, d);
        });
        service = new ARM.Simulator.Tests.MockService();
        expect(gpio.OnRegister(service)).toBe(true);
    });

    /**
     * Runs after each test method.
     */
    afterEach(() => {
        read = null;
        write = null;
        gpio.OnUnregister();
    });

    /**
     * Ensures all pins of all ports are configured as input after reset.
     */
    it('Reset Values', function () {
        // Read IO0DIR register.
        var value = gpio.Read(0x04, ARM.Simulator.DataType.Word);
        expect(value).toBe(0);
        // Read IO1DIR register.
        value = gpio.Read(0x14, ARM.Simulator.DataType.Word);
        expect(value).toBe(0);
    });

    /**
     * Ensures reading from an I/O port invokes the user-defined callback.
     */
    it('Read from I/O port', function () {
        var ports = [0x12345678, 0x87654321];
        read = p => {
            return ports[p];
        };
        // GPIO pins are configured as input after reset.
        var value = gpio.Read(0x00, ARM.Simulator.DataType.Word);
        expect(value).toBe(ports[0]);
        // Read second port.
        value = gpio.Read(0x10, ARM.Simulator.DataType.Word);
        expect(value).toBe(ports[1]);
    });

    /**
     * Ensures writing to an I/O port invokes the user-defined callback.
     */
    it('Write to I/O port', function () {
        var ports = [0, 0];
        write = (p, v, s, c, d) => {
            if (s)
                ports[p] |= v;
            if (c)
                ports[p] &= v;
        };
        read = p => {
            return ports[p];
        }
        // Writing to IOxPIN should work regardless of configured pin directions.
        var value = gpio.Read(0x00, ARM.Simulator.DataType.Word);
        expect(value).toBe(0);
        gpio.Write(0x00, ARM.Simulator.DataType.Word, 0x12345678);
        value = gpio.Read(0x00, ARM.Simulator.DataType.Word);
        expect(value).toBe(0x12345678);
        // Port 2 should still have its initial value.
        value = gpio.Read(0x10, ARM.Simulator.DataType.Word);
        expect(value).toBe(0);
        gpio.Write(0x10, ARM.Simulator.DataType.Word, 0x44444444);
        value = gpio.Read(0x10, ARM.Simulator.DataType.Word);
        expect(value).toBe(0x44444444);
        // Port 1 should still be 0x12345678.
        value = gpio.Read(0x00, ARM.Simulator.DataType.Word);
        expect(value).toBe(0x12345678);
    });

    /**
     * Ensures that setting input/output directions of individual pins works as expected.
     */
    it('Set Pin Direction', function () {
        // Configure PIN0, PIN12-PIN14 and PIN22 as outputs.
        var m = 0x407001;
        var clear = false;
        write = (p, v, s, c, d) => {
            // SET call so s should be true and clear false.
            if (!clear) {
                expect(s).toBe(true);
                expect(c).toBe(false);
                expect(d).toBe(m);
            } else {
                expect(s).toBe(false);
                expect(c).toBe(true);
                expect(v).toBe(0);
            }
        };
        // GPIO pins are configured as input after reset.
        var value = gpio.Read(0x04, ARM.Simulator.DataType.Word);
        expect(value).toBe(0);
        gpio.Write(0x04, ARM.Simulator.DataType.Word, m);
        value = gpio.Read(0x04, ARM.Simulator.DataType.Word);
        expect(value).toBe(m);
        // Set output pins HIGH.
        gpio.Write(0x08, ARM.Simulator.DataType.Word, m);
        clear = true;
        // Clear output to LOW.
        gpio.Write(0x0C, ARM.Simulator.DataType.Word, ~0);
    });
});