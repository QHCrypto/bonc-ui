import type { Settings } from "./server/bonc";

export const DEFAULT_SETTINGS: Settings = {
  clangPath: process.env.CLANG_PATH || '/usr/bin/bonc-clang',
  boncLibPath: process.env.BONC_LIB_PATH || '/usr/include/bonc',
  frontendPath: process.env.BONC_FRONTEND_PATH || '/usr/bin/bonc-frontend',
  backendNmPath: process.env.BONC_BACKEND_NM_PATH || '/usr/bin/bonc-backend-nm',
  backendSatPath: process.env.BONC_BACKEND_SAT_PATH || '/usr/bin/bonc-backend-sat',
  backendDpPath: process.env.BONC_BACKEND_DP_PATH || '/usr/bin/bonc-backend-dp',
}

export const DEFAULT_CODE = `#include <stdint.h>
#include <stdio.h>

#include <bonc.h>

static const uint8_t S_BOX[16] = {0xE, 0x4, 0xD, 0x1, 0x2, 0xF, 0xB, 0x8, 0x3, 0xA, 0x6, 0xC, 0x5, 0x9, 0x0, 0x7};
static uint8_t INV_S_BOX[16];

static const uint8_t P_BOX[16] = {0,4,8,12,1,5,9,13,2,6,10,14,3,7,11,15};
static const uint8_t INV_P_BOX[16] = {0,4,8,12,1,5,9,13,2,6,10,14,3,7,11,15};

uint16_t substitute(uint16_t input) {
    uint16_t output = 0;
    for (int i = 0; i < 4; i++) {
        uint8_t chunk = (input >> (4 * (3 - i))) & 0xF;
        output |= (S_BOX[chunk] << (4 * (3 - i)));
    }
    return output;
}
uint16_t permute(uint16_t input) {
    uint16_t output = 0;
    for (int i = 0; i < 16; i++) {
        uint8_t bit = (input >> i) & 0x1;
        output |= (bit << P_BOX[i]);
    }
    return output;
}

[[bonc::round]]
void encrypt_round(uint16_t* ciphertext, uint16_t subkey) {
    *ciphertext = substitute(*ciphertext);
    *ciphertext = permute(*ciphertext);
    *ciphertext ^= subkey;
}

uint16_t encrypt(uint16_t plaintext, uint16_t *subkeys, int rounds) {
    uint16_t ciphertext = plaintext ^ subkeys[0];
    for (int i = 0; i < rounds - 1; i++) {
        encrypt_round(&ciphertext, subkeys[i]);
    }
    ciphertext = substitute(ciphertext);
    ciphertext ^= subkeys[rounds];
    return ciphertext;
}

void generate_subkeys(uint32_t master_key, uint16_t *subkeys, int total_subkeys) {
    uint8_t k[4];
    k[0] = (master_key >> 24) & 0xFF;
    k[1] = (master_key >> 16) & 0xFF;
    k[2] = (master_key >> 8) & 0xFF;
    k[3] = master_key & 0xFF;

    for (int i = 0; i < total_subkeys; i++) {
        subkeys[i] = (k[0] << 8) | k[1];
        // 循环左移一个字节
        uint8_t temp = k[0];
        k[0] = k[1];
        k[1] = k[2];
        k[2] = k[3];
        k[3] = temp;
    }
}

void bonc_main([[bonc::metaparam(1 ... 6)]] int rounds) {
  uint16_t subkeys[7];
  uint16_t* plaintext = bonc_input_plaintext(sizeof(uint16_t));
  uint32_t* master_key = bonc_input_key(sizeof(uint32_t));
  generate_subkeys(*master_key, subkeys, rounds);

  uint16_t ciphertext = encrypt(*plaintext, subkeys, rounds);

  bonc_output_ciphertext(&ciphertext, sizeof(ciphertext));
}
`