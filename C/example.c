#include "devboard.h"

int main() {
    char *s[] = {
        "Hello from compiled C program!",
        "Press and hold any of the number",
        "keys from 0-7 on your keyboard",
        "to enable the respective LED.",
        "Press 9 to exit the program.",
        0
    };
    char **p = s;
    int i;
    lcd_init();
    /* print intro text */
    while(*p) {
        lcd_clear();
        lcd_write_string(*p);
        for(i = 0; i < 20; i++)
            delay();
        p++;
    }
    /* poll buttons in a loop until user exits */
    while(poll_buttons())
        ;
    lcd_clear();
    lcd_write_string("Good Bye!");
    do_led_animation();
    return 0;
}

void lcd_init() {
    lcd_command(LCD_CMD_DISP_CLEAR);
    /* 2-line 5x10 dots format display mode. */
    lcd_command(LCD_CMD_FUNCTION_SET);
    /* turn display on, cursor on, blink-mode on. */
    lcd_command(LCD_CMD_DISP_CONTROL);
    /* enable cursor increment mode */
    lcd_command(LCD_CMD_ENTRY_MODE);
}

void lcd_command(unsigned char cmd) {
    LCDIOCTL = cmd;
    delay();
    /* exec command */
    LCDIOCTL |= 0x80;
    delay();
}

void lcd_clear() {
    lcd_command(LCD_CMD_DISP_CLEAR);
}

void lcd_write_char(char c) {
   LCDDATA = c;
}

void lcd_write_string(char *s) {
    while(*s) {
        lcd_write_char(*s++);
        delay();
        delay();
    }
}

void set_leds(unsigned char status) {
    LEDSTAT = status; 
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

int poll_buttons() {
    int buttons = BTNSTAT, leds = 0;
    int i;
    for(i = 1; i < 9; i++) {
        if (buttons & (1 << i))
            leds |= (1 << (i - 1));
        else
            leds &= ~(1 << (i - 1));
    }
    set_leds(leds);
    /* return 0 to exit, otherwise keep going */
    return !(buttons & (1 << 9));
}