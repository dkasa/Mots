#!/bin/bash

set -e

DATA_DIR="./data"
AUDIO_DIR="./audio"

VOICE_MALE="Thomas"
VOICE_FEMALE="Amelie"
RATE=150

normalize() {
  local text="$1"
  text=$(echo "$text" | tr '[:upper:]' '[:lower:]')
  text=$(echo "$text" | sed "s/'//g")
  text=$(echo "$text" | sed "s/,/_/g")
  text=$(echo "$text" | sed "s/ /_/g")
  text=$(echo "$text" | iconv -f UTF-8 -t ASCII//TRANSLIT)
  text=$(echo "$text" | sed 's/[^a-z0-9_]//g')
  echo "$text"
}

expand_word() {
  local word="$1"
  if [[ "$word" == *","* ]]; then
    base="${word%%,*}"
    suffix="${word#*,}"
    echo "$base"
    echo "$base$suffix"
  else
    echo "$word"
  fi
}

echo "🎙️  Generating French audio..."

mkdir -p "$AUDIO_DIR"
rm -f failed_words.txt

for json in "$DATA_DIR"/grade*_words.json; do
  grade=$(basename "$json" | sed 's/_words.json//')

  echo "📘 Processing $grade"

  out_male="$AUDIO_DIR/$grade/male"
  out_female="$AUDIO_DIR/$grade/female"

  mkdir -p "$out_male" "$out_female"

  jq -r '.[].french' "$json" | while read -r word; do
    [[ -z "$word" ]] && continue

    expand_word "$word" | while read -r w; do
      fname=$(normalize "$w")

      out_m="$out_male/$fname.aiff"
      out_f="$out_female/$fname.aiff"
      mp3_m="${out_m%.aiff}.mp3"
      mp3_f="${out_f%.aiff}.mp3"

      # Male voice
      if [[ ! -f "$out_m" ]] && [[ ! -f "$mp3_m" ]]; then
        echo "  🔊 Male: $w"
        say -v "$VOICE_MALE" -r $RATE -o "$out_m" "$w." 2>/dev/null || {
          echo "    ❌ Failed to generate Male audio for: $w"
          echo "$w" >> failed_words.txt
          continue
        }
        ffmpeg -y -i "$out_m" -codec:a libmp3lame -q:a 2 "$mp3_m" >/dev/null 2>&1 && rm "$out_m"
      fi

      # Female voice
      if [[ ! -f "$out_f" ]] && [[ ! -f "$mp3_f" ]]; then
        echo "  🔊 Female: $w"
        say -v "$VOICE_FEMALE" -r $RATE -o "$out_f" "$w." 2>/dev/null || {
          echo "    ❌ Failed to generate Female audio for: $w"
          echo "$w" >> failed_words.txt
          continue
        }
        ffmpeg -y -i "$out_f" -codec:a libmp3lame -q:a 2 "$mp3_f" >/dev/null 2>&1 && rm "$out_f"
      fi
    done
  done
done

echo "✅ All French audio generated to MP3."
echo "📂 Audio files saved in: $AUDIO_DIR"