#include "devboard.h"

int main() {
	unsigned char status = 0xff;
	while(1) {
		set_leds(status++);
//		status = status >> 1;
//		if(!status)
//			status = 0x80;
//		sleep(100);
	}
}

void set_leds(unsigned char status) {
	*((unsigned char*)LED_IOCTL) = status; 
}

void sleep(int m) {
	int i;
	for(i = 0; i < 1000000; i++)
		;
}