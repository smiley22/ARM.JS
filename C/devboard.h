#ifndef _DEVBOARD_H_
#define _DEVBOARD_H_

#define LED_IOCTL	0x80000000
#define VID_BASE	0x60000000

#define CLOCK_SPEED 6800000

void set_leds(unsigned char status);
void sleep(int m);

#endif /* _DEVBOARD_H_ */