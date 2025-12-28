import type { Settings } from "./server/bonc";

export const DEFAULT_SETTINGS: Settings = {
  clangPath: process.env.CLANG_PATH || '/usr/bin/bonc-clang',
  boncLibPath: process.env.BONC_LIB_PATH || '/usr/include/bonc',
  frontendPath: process.env.BONC_FRONTEND_PATH || '/usr/bin/bonc-frontend',
  backendNmPath: process.env.BONC_BACKEND_NM_PATH || '/usr/bin/bonc-backend-nm',
  backendSatPath: process.env.BONC_BACKEND_SAT_PATH || '/usr/bin/bonc-backend-sat',
  backendDpPath: process.env.BONC_BACKEND_DP_PATH || '/usr/bin/bonc-backend-dp',
}

const TINY_EXAMPLE_CODE = `#include <stdint.h>
#include <stdio.h>

#include <bonc.h>

static const uint8_t S_BOX[16] = {0xE, 0x4, 0xD, 0x1, 0x2, 0xF, 0xB, 0x8, 0x3, 0xA, 0x6, 0xC, 0x5, 0x9, 0x0, 0x7};

static const uint8_t P_BOX[16] = {0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15};

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

const GIFT64_CODE = `/*
GIFT-64-128 implementation in C
Date: 06 March 2017
Converted from C++ to C by Copilot, July 2025
Original by: Siang Meng Sim

Last modification on: 01 November 2017 (C++ version)
*/

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#include <bonc.h>

// Sbox
const unsigned char GIFT_S[16] = {1, 10, 4,  12, 6, 15, 3, 9,
                                  2, 13, 11, 7,  5, 0,  8, 14};

// bit permutation
const unsigned char GIFT_P[] = {
    /* Block size = 64 */
    0,  17, 34, 51, 48, 1,  18, 35, 32, 49, 2,  19, 16, 33, 50, 3,
    4,  21, 38, 55, 52, 5,  22, 39, 36, 53, 6,  23, 20, 37, 54, 7,
    8,  25, 42, 59, 56, 9,  26, 43, 40, 57, 10, 27, 24, 41, 58, 11,
    12, 29, 46, 63, 60, 13, 30, 47, 44, 61, 14, 31, 28, 45, 62, 15};

// round constants
const unsigned char GIFT_RC[62] = {
    0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3E, 0x3D, 0x3B, 0x37, 0x2F, 0x1E,
    0x3C, 0x39, 0x33, 0x27, 0x0E, 0x1D, 0x3A, 0x35, 0x2B, 0x16, 0x2C,
    0x18, 0x30, 0x21, 0x02, 0x05, 0x0B, 0x17, 0x2E, 0x1C, 0x38, 0x31,
    0x23, 0x06, 0x0D, 0x1B, 0x36, 0x2D, 0x1A, 0x34, 0x29, 0x12, 0x24,
    0x08, 0x11, 0x22, 0x04, 0x09, 0x13, 0x26, 0x0c, 0x19, 0x32, 0x25,
    0x0a, 0x15, 0x2a, 0x14, 0x28, 0x10, 0x20};

void enc64(unsigned char* input, unsigned char* masterkey, int no_of_rounds,
           int print_details);

void bonc_main([[bonc::metaparam(1 ... 28)]] int round) {
  unsigned char* P = bonc_input_plaintext(16);
  unsigned char* K = bonc_input_key(32);
  enc64(P, K, round, 0);
  bonc_output_ciphertext(P, 16);
}

void enc64(unsigned char* input, unsigned char* masterkey, int no_of_rounds,
           int print_details) {
  unsigned char key[32];
  for (int i = 0; i < 32; i++) {
    key[i] = masterkey[i];
  }

  unsigned char bits[64], perm_bits[64];
  unsigned char key_bits[128];
  unsigned char temp_key[32];
  [[bonc::round]]
  for (int r = 0; r < no_of_rounds; r++) {
    // SubCells
    for (int i = 0; i < 16; i++) {
      input[i] = GIFT_S[input[i] & 0xf];
    }

    // PermBits
    // input to bits
    for (int i = 0; i < 16; i++) {
      for (int j = 0; j < 4; j++) {
        bits[4 * i + j] = (input[i] >> j) & 0x1;
      }
    }
    // permute the bits
    for (int i = 0; i < 64; i++) {
      perm_bits[GIFT_P[i]] = bits[i];
    }
    // perm_bits to input
    for (int i = 0; i < 16; i++) {
      input[i] = 0;
      for (int j = 0; j < 4; j++) {
        input[i] ^= perm_bits[4 * i + j] << j;
      }
    }

    // AddRoundKey
    // input to bits
    for (int i = 0; i < 16; i++) {
      for (int j = 0; j < 4; j++) {
        bits[4 * i + j] = (input[i] >> j) & 0x1;
      }
    }
    // key to key_bits
    for (int i = 0; i < 32; i++) {
      for (int j = 0; j < 4; j++) {
        key_bits[4 * i + j] = (key[i] >> j) & 0x1;
      }
    }

    // add round key
    int kbc = 0;  // key_bit_counter
    for (int i = 0; i < 16; i++) {
      bits[4 * i] ^= key_bits[kbc];
      bits[4 * i + 1] ^= key_bits[kbc + 16];
      kbc++;
    }

    // add constant
    bits[3] ^= GIFT_RC[r] & 0x1;
    bits[7] ^= (GIFT_RC[r] >> 1) & 0x1;
    bits[11] ^= (GIFT_RC[r] >> 2) & 0x1;
    bits[15] ^= (GIFT_RC[r] >> 3) & 0x1;
    bits[19] ^= (GIFT_RC[r] >> 4) & 0x1;
    bits[23] ^= (GIFT_RC[r] >> 5) & 0x1;
    bits[63] ^= 1;

    // bits to input
    for (int i = 0; i < 16; i++) {
      input[i] = 0;
      for (int j = 0; j < 4; j++) {
        input[i] ^= bits[4 * i + j] << j;
      }
    }
    
    // key update
    // entire key>>32
    for (int i = 0; i < 32; i++) {
      temp_key[i] = key[(i + 8) % 32];
    }
    for (int i = 0; i < 24; i++) key[i] = temp_key[i];
    // k0>>12
    key[24] = temp_key[27];
    key[25] = temp_key[24];
    key[26] = temp_key[25];
    key[27] = temp_key[26];
    key[28] = ((temp_key[28] & 0xc) >> 2) ^ ((temp_key[29] & 0x3) << 2);
    key[29] = ((temp_key[29] & 0xc) >> 2) ^ ((temp_key[30] & 0x3) << 2);
    key[30] = ((temp_key[30] & 0xc) >> 2) ^ ((temp_key[31] & 0x3) << 2);
    key[31] = ((temp_key[31] & 0xc) >> 2) ^ ((temp_key[28] & 0x3) << 2);
  }
}
`

export { GIFT64_CODE as DEFAULT_CODE };