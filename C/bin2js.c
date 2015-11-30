#include <stdio.h>

int main(int argc, char **argv) {
	if(argc < 2) {
		printf("usage: bin2js <filename> [<varname>]\n");
		return 0;
	}
	FILE *fd = fopen(argv[1], "rb");
	if(!fd) {
		printf("couldn't open file %s\n", argv[1]);
		return 0;
	}
	char *name = argc > 2 ? argv[2] : "Bin";
	printf("var %s = [\n\t", name);
	unsigned char b;
	int nl = 0;
	while(!feof(fd)) {
		fread(&b, 1, 1, fd);
		if(nl >= 10) {
			nl = 0;
			printf("\n\t");
		}
		printf("0x%02X", b);
		if(!feof(fd))
			printf(", ");
		nl++;
	}
	printf("\n];");
	fclose(fd);
}