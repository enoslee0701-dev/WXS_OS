#!/bin/zsh
# 在服务器这台 Mac 上安装本机 AI（llama.cpp + Qwen2.5 7B 中文模型，约 4.7GB；建议 16GB 以上内存的 Apple 芯片 Mac）。
# 没有配置 Claude 密钥时，AI 整理想法、AI 助手、拆待办、新建项目解析等功能由它完成，数据不出这台电脑、不花钱。
# 配置了 Claude 密钥后自动改用 Claude（效果更好，还能看图片、读 PDF）。
# 用法：scripts/llm-mac.sh     装好后重启团队服务器：scripts/server-mac.sh install
set -e
DIR=~/Library/TeamOps; mkdir -p $DIR/models
CM=$(command -v cmake || true)
if [ -z "$CM" ]; then python3 -m pip install --user --quiet cmake; CM=$(ls ~/Library/Python/*/bin/cmake | head -1); fi
if [ ! -x $DIR/llama.cpp/build/bin/llama-server ]; then
  rm -rf $DIR/llama.cpp; git clone --depth 1 -q https://github.com/ggml-org/llama.cpp.git $DIR/llama.cpp
  (cd $DIR/llama.cpp && $CM -B build -DCMAKE_BUILD_TYPE=Release -DLLAMA_CURL=OFF -DBUILD_SHARED_LIBS=OFF -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF >/dev/null && $CM --build build -j 8 --config Release --target llama-server >/dev/null)
fi
M=$DIR/models/Qwen2.5-7B-Instruct-Q4_K_M.gguf
[ -s $M ] || { curl -L --progress-bar -o $M.part "https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf" && mv $M.part $M; }
echo "本机 AI 已安装：$DIR"
echo "重启团队服务器后生效：scripts/server-mac.sh install"
