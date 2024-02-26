#include <stdio.h>
#include <emscripten.h>

int main() {
    EM_ASM( if_octane_allReady() );
    return 0;
}