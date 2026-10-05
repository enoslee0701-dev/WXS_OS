#!/bin/zsh
# 在服务器这台 Mac 上安装离线语音转写（whisper.cpp + 中文效果好的 large-v3-turbo 模型，约 550MB），装好后重启团队服务器即可。
# 录音和视频上传后会自动转成文字，全部在这台电脑上完成，不发给任何第三方。
# 用法：scripts/whisper-mac.sh        需要：Xcode 命令行工具、python3、ffmpeg
set -e
DIR=~/Library/TeamOps; mkdir -p $DIR/models
command -v ffmpeg >/dev/null || [ -x ~/bin/ffmpeg ] || [ -x /opt/homebrew/bin/ffmpeg ] || { echo "缺少 ffmpeg：请先安装（例如 brew install ffmpeg），再运行本脚本"; exit 1; }
CM=$(command -v cmake || true)
if [ -z "$CM" ]; then python3 -m pip install --user --quiet cmake; CM=$(ls ~/Library/Python/*/bin/cmake | head -1); fi
if [ ! -x $DIR/whisper.cpp/build/bin/whisper-cli ]; then
  rm -rf $DIR/whisper.cpp; git clone --depth 1 -q https://github.com/ggml-org/whisper.cpp.git $DIR/whisper.cpp
  (cd $DIR/whisper.cpp && $CM -B build -DCMAKE_BUILD_TYPE=Release -DWHISPER_BUILD_TESTS=OFF -DBUILD_SHARED_LIBS=OFF >/dev/null && $CM --build build -j 8 --config Release --target whisper-cli >/dev/null)
fi
M=$DIR/models/ggml-large-v3-turbo-q5_0.bin
[ -s $M ] || curl -L --progress-bar -o $M "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin"
echo "语音转写已安装：$DIR"
echo "重启团队服务器后生效：scripts/server-mac.sh install"
