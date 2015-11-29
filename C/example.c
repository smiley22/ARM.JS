#include "devboard.h"

int main() {
	char *s[] = {
		"Hello from compiled C program!",
		"Maybe we should add some more ",
		"stuff to play around with ",
		"like a couple of push buttons ",
		"a PIC or a UART...then we could",
		"write some proper programs :]",
		0
	};
	char **p = s;
	int i;
	lcd_init();
	while(*p) {
		lcd_clear();
		lcd_write_string(*p);
		for(i = 0; i < 20; i++)
			delay();
		p++;
	}
	do_led_animation();
	return 0;
}

void lcd_init() {
	lcd_command(LCD_DISP_CLEAR);
	/* 2-line 5x10 dots format display mode. */
	lcd_command(LCD_FUNCTION_SET);
	/* turn display on, cursor on, blink-mode on. */
	lcd_command(LCD_DISP_CONTROL);
	/* enable cursor increment mode */
	lcd_command(LCD_ENTRY_MODE);
}

void lcd_command(unsigned char cmd) {
	*((unsigned char*)LCDC_IOCTL) = cmd;
	/* exec command */
	*((unsigned char*)LCDC_IOCTL) = 0x80;
	delay();
}

void lcd_clear() {
	lcd_command(LCD_DISP_CLEAR);
}

void lcd_write_char(char c) {
	*((char*)LCDC_DATA) = c;
}

void lcd_write_string(char *s) {
	while(*s) {
		lcd_write_char(*s++);
		delay();
		delay();
	}
}

void set_leds(unsigned char status) {
	*((unsigned char*)LED_IOCTL) = status; 
}

void delay() {
	int i;
	for(i = 0; i < 10; i++)
		;
}

void do_led_animation() {
	unsigned char mask = 0xff;
	int i;
	while(mask) {
		set_leds(mask);
		for(i = 0; i < 5; i++)
			delay();
		mask = mask >> 1;
	}
	mask = 0x01;
	while(mask) {
		set_leds(mask);
		for(i = 0; i < 5; i++)
			delay();
		mask = (mask << 1);
	}
}