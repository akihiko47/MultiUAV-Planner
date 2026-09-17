#pragma once

#ifdef __cplusplus
extern "C" {
#endif

// Возвращает указатель на строку, выделенную malloc.
// Память освобождается через free_string.
char* plan_json(const char* request_json);

void free_string(char* p);

#ifdef __cplusplus
}
#endif