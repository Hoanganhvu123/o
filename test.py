import edge_tts
import asyncio
import json
import os
import time
from datetime import datetime

STORIES = [
    {
        "id": "tam_cam",
        "text": """Ngày xưa, có một cô gái tên là Tấm, sống với cha và mẹ kế cùng người em cùng cha khác mẹ tên là Cám. Tấm hiền lành, chăm chỉ nhưng thường xuyên bị mẹ kế và Cám đối xử tệ bạc. Hàng ngày, Tấm phải làm tất cả công việc nặng nhọc trong nhà.

Một hôm, mẹ kế bảo hai chị em ra đồng bắt tép. Bà đưa cho Tấm một cái rổ thưa, còn Cám được một cái rổ kín. Tấm cố gắng bắt tép nhưng tép cứ tuột hết qua lỗ rổ. Đang lúc buồn bã, Bụt hiện ra và cho Tấm một cái rổ mới, nhờ đó Tấm bắt được rất nhiều tép.

Thấy vậy, mẹ kế và Cám ghen tị, họ nghĩ ra một kế độc ác. Họ sai Tấm trèo lên cây bàng hái lá, rồi lấy rìu chặt gốc cây khiến Tấm rơi xuống giếng sâu. May mắn thay, Tấm được cá thần cứu giúp và biến thành một cô gái xinh đẹp hơn xưa.

Một ngày nọ, trong làng có hội, vua đi ngang qua và gặp Tấm. Bị thu hút bởi vẻ đẹp và sự dịu dàng của Tấm, vua đã đem lòng yêu mến và rước Tấm về cung làm hoàng hậu. Cuộc sống của Tấm trong cung vô cùng hạnh phúc, được vua yêu thương và nâng niu.

Thế nhưng, mẹ kế và Cám vẫn không từ bỏ ý định hãm hại Tấm. Họ lừa Tấm trở về nhà và giết hại. Nhưng với sự giúp đỡ của các vị thần, Tấm đã nhiều lần hóa kiếp thành chim vàng anh, cây xoan đào, và cuối cùng là khôi phục lại hình dáng con người.

Cuối cùng, cái ác đã bị trừng phạt, cái thiện được đền đáp. Tấm được đoàn tụ với vua, sống hạnh phúc mãi mãi. Câu chuyện Tấm Cám dạy chúng ta rằng dù cuộc sống có khó khăn đến đâu, những người hiền lành, chăm chỉ và tốt bụng sẽ luôn được ông trời phù hộ và có được hạnh phúc xứng đáng.""",
        "expression": "happy",
        "motion": "nod"
    },
    {
        "id": "su_tich_banh_chung",
        "text": """Ngày xưa, có vị vua Hùng muốn truyền ngôi cho con. Nhà vua họp các hoàng tử lại và phán rằng: "Con nào tìm được món ăn vừa ý ta nhất để dâng cúng tổ tiên sẽ được truyền ngôi báu."

Trong khi các anh em khác đi tìm những sơn hào hải vị quý hiếm, Lang Liêu - người con nghèo khó nhất - chỉ có thể làm được hai món ăn đơn giản từ gạo nếp. Anh gói gạo nếp thành hình vuông tượng trưng cho đất, bên trong có nhân đậu xanh và thịt, bọc bằng lá dong xanh, và đặt tên là bánh chưng. Món thứ hai hình tròn tượng trưng cho trời, được gọi là bánh giày.

Khi vua Hùng nếm thử các món ăn của các hoàng tử, ngài rất hài lòng với ý nghĩa và hương vị của bánh chưng, bánh giày. Vua cho rằng đây là món ăn thể hiện lòng hiếu thảo và sự tinh tế, vừa dân dã vừa đậm đà bản sắc dân tộc. Vì thế, Lang Liêu được chọn làm người kế vị ngai vàng.

Từ đó, bánh chưng và bánh giày trở thành món ăn truyền thống không thể thiếu trong dịp Tết của người Việt Nam. Câu chuyện này không chỉ nói về nguồn gốc của bánh chưng, bánh giày mà còn dạy chúng ta rằng sự thành công không phụ thuộc vào của cải vật chất mà là ở tấm lòng và sự sáng tạo.""",
        "expression": "happy",
        "motion": "wave"
    },
    {
        "id": "son_tinh_thuy_tinh",
        "text": """Thuở xưa, có một vị vua tên là Hùng Vương thứ 18 có người con gái tên là Mỵ Nương, nàng xinh đẹp tuyệt trần. Đến tuổi cập kê, có hai người đến cầu hôn là Sơn Tinh và Thủy Tinh. Cả hai đều có tài phép phi thường.

Sơn Tinh có khả năng dời non lấp bể, tay trái chỉ lên núi, núi cao vút; tay phải chỉ xuống đất, đất nổi thành gò. Còn Thủy Tinh có thể hô mưa gọi gió, sai khiến thủy tộc, dâng nước lên cao hay hạ xuống thấp tùy ý.

Vua Hùng phán rằng: "Hai khanh đều có tài, nhưng trẫm chỉ có một con gái. Vậy sáng mai, ai đem sính lễ đến trước sẽ được kết duyên cùng Mỵ Nương." Sáng hôm sau, Sơn Tinh đến sớm với sính lễ gồm voi chín ngà, gà chín cựa, ngựa chín hồng mao. Vua Hùng gả công chúa cho chàng.

Thủy Tinh đến sau, thấy Mỵ Nương đã về với Sơn Tinh thì vô cùng tức giận. Thủy Tinh dùng phép thuật dâng nước lên cao, gây mưa bão để đánh Sơn Tinh. Sơn Tinh dùng phép thuật nâng đất lên cao để chống chọi. Cuộc chiến kéo dài nhiều ngày, cuối cùng Thủy Tinh đành rút lui.

Từ đó, hàng năm cứ đến mùa mưa bão, Thủy Tinh lại dâng nước lên để đánh Sơn Tinh, nhưng không bao giờ thắng được. Người dân cho rằng đó chính là nguyên nhân của những trận lũ lụt hàng năm ở vùng đồng bằng Bắc Bộ.""",
        "expression": "surprised",
        "motion": "shake"
    },
    {
        "id": "thanh_giong",
        "text": """Ngày xưa, ở làng Phù Đổng có một cặp vợ chồng già hiếm muộn. Một hôm, người vợ ra đồng thấy một dấu chân khổng lồ, bà đặt chân mình vào thử. Về nhà, bà có thai và sinh ra một cậu bé. Đến ba tuổi, cậu bé vẫn không biết nói, không biết cười, suốt ngày chỉ nằm im.

Lúc bấy giờ, giặc Ân đang quấy phá bờ cõi. Vua Hùng cho người đi khắp nơi tìm người tài giỏi cứu nước. Khi sứ giả đi qua làng Phù Đổng, cậu bé bỗng cất tiếng nói với mẹ: "Mẹ ra mời sứ giả vào đây cho con". Sứ giả vào nhà, cậu bé bảo: "Về tâu với vua, đúc cho ta một con ngựa sắt, một roi sắt và một áo giáp sắt, ta sẽ phá giặc."

Vua nghe tâu liền cho đúc những thứ cậu bé yêu cầu. Khi sứ giả mang về, cậu bé vươn vai một cái, lớn nhanh như thổi, thành một tráng sĩ cao lớn. Tráng sĩ mặc áo giáp, cưỡi ngựa sắt phi thẳng ra trận.

Đến nơi, tráng sĩ cầm roi sắt đánh giặc. Khi roi sắt gãy, ngài nhổ những bụi tre bên đường quật vào giặc. Giặc tan tác bỏ chạy. Đánh xong giặc, tráng sĩ phi ngựa lên núi Sóc, cởi áo giáp để lại rồi bay về trời.

Để tưởng nhớ công ơn của người anh hùng, vua phong tráng sĩ là Phù Đổng Thiên Vương, lập đền thờ ở làng Phù Đổng. Câu chuyện ca ngợi tinh thần yêu nước, sức mạnh phi thường và lòng dũng cảm của người anh hùng áo vải.""",
        "expression": "happy",
        "motion": "dance"
    }
]

def log_message(message, is_error=False):
    """In log message với timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    prefix = "ERROR" if is_error else "INFO"
    print(f"[{timestamp}] {prefix}: {message}")

async def generate_audio_for_story(story, output_dir, voice):
    """Tạo audio cho một câu chuyện"""
    try:
        start_time = time.time()
        story_id = story['id']
        output_file = f"{output_dir}/{story_id}.mp3"
        
        log_message(f"Bắt đầu tạo audio cho câu chuyện: {story_id}")
        log_message(f"- Độ dài text: {len(story['text'])} ký tự")
        
        communicate = edge_tts.Communicate(story['text'], voice)
        await communicate.save(output_file)
        
        file_size = os.path.getsize(output_file) / (1024 * 1024)  # Convert to MB
        end_time = time.time()
        duration = end_time - start_time
        
        story['audio_url'] = f"/idle-stories/audio/{story_id}.mp3"
        log_message(f"✓ Hoàn thành audio cho {story_id}:")
        log_message(f"  - Thời gian xử lý: {duration:.2f} giây")
        log_message(f"  - Kích thước file: {file_size:.2f} MB")
        log_message(f"  - Đường dẫn: {story['audio_url']}")
        
        return story
        
    except Exception as e:
        log_message(f"Lỗi khi tạo audio cho {story['id']}: {str(e)}", True)
        raise e

async def generate_all_audio():
    total_start_time = time.time()
    
    try:
        # Tạo thư mục nếu chưa có
        output_dir = "frontend/Open-LLM-VTuber-Web/public/idle-stories/audio"
        os.makedirs(output_dir, exist_ok=True)
        log_message(f"Đã tạo thư mục output: {output_dir}")
        
        # Voice của Microsoft Edge TTS
        voice = "vi-VN-HoaiMyNeural"
        log_message(f"Sử dụng voice: {voice}")
        
        # Tạo audio song song cho tất cả câu chuyện
        log_message(f"Bắt đầu tạo {len(STORIES)} audio files song song...")
        tasks = [generate_audio_for_story(story, output_dir, voice) for story in STORIES]
        updated_stories = await asyncio.gather(*tasks)
        
        # Lưu stories.json
        json_file = "frontend/Open-LLM-VTuber-Web/public/idle-stories/stories.json"
        os.makedirs(os.path.dirname(json_file), exist_ok=True)
        
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump({"stories": updated_stories}, f, ensure_ascii=False, indent=2)
        
        total_duration = time.time() - total_start_time
        log_message(f"✓ Hoàn thành tất cả:")
        log_message(f"  - Tổng thời gian: {total_duration:.2f} giây")
        log_message(f"  - Số file đã tạo: {len(updated_stories)}")
        log_message(f"  - File JSON: {json_file}")

    except Exception as e:
        log_message(f"Lỗi trong quá trình tạo audio: {str(e)}", True)
        raise e

if __name__ == "__main__":
    log_message("Bắt đầu chương trình tạo audio...")
    asyncio.run(generate_all_audio()) 