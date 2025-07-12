const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const TOKEN = 'process.env.TOKEN';
const CLIENT_ID = '1393635555799076938';
const CHANNEL_ID = '1393722175659442236'; // ID الروم اللي البوت هيبعت فيها الرسالة
const allowedRoleId = '1285874285830733855'; // ID الرول المسموح لها تستخدم أوامر الإدارة

// إنشاء العميل
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// الأوامر
const commands = [
  new SlashCommandBuilder()
    .setName('setname')
    .setDescription('يغير اسم البوت')
    .addStringOption(option =>
      option.setName('name').setDescription('الاسم الجديد').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('setavatar')
    .setDescription('يغير صورة البوت')
    .addStringOption(option =>
      option.setName('url').setDescription('رابط الصورة الجديدة').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('sharepg')
    .setDescription('يضيف رابط صفحة شخص')
    .addStringOption(option =>
      option.setName('url').setDescription('رابط الصفحة (YouTube/TikTok/Facebook)').setRequired(true)
    )
    .addUserOption(option =>
      option.setName('user').setDescription('صاحب الصفحة').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('deletepg')
    .setDescription('يحذف صفحة بالرابط فقط (مسموح للي معاه الرول)')
    .addStringOption(option =>
      option.setName('url').setDescription('رابط الصفحة').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('pages')
    .setDescription('يعرض كل الصفحات الخاصة بشخص')
    .addUserOption(option =>
      option.setName('user').setDescription('الشخص').setRequired(true)
    ),
].map(command => command.toJSON());

// تسجيل الأوامر
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    console.log('📦 تسجيل الأوامر...');
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands },
    );
    console.log('✅ تم تسجيل الأوامر!');
  } catch (error) {
    console.error(error);
  }
})();

// تجهيز ملف البيانات
let data = { youtube: [], tiktok: [], facebook: [], messageId: null };
if (fs.existsSync('data.json')) {
  data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
}

// لما البوت يشتغل
client.once('ready', () => {
  console.log(`🤖 جاهز! Logged in as ${client.user.tag}`);
});

// معالجة الأوامر
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'setname') {
    if (!interaction.member.roles.cache.has(allowedRoleId)) {
      return interaction.reply({ content: '❌ ليس لديك الصلاحية لاستخدام هذا الأمر.', ephemeral: true });
    }
    const name = interaction.options.getString('name');
    try {
      await client.user.setUsername(name);
      await interaction.reply(`✅ تم تغيير اسم البوت إلى: **${name}**`);
    } catch (error) {
      console.error(error);
      await interaction.reply('❌ حصل خطأ أثناء تغيير الاسم (ممكن يكون rate limit).');
    }
  }

  else if (interaction.commandName === 'setavatar') {
    if (!interaction.member.roles.cache.has(allowedRoleId)) {
      return interaction.reply({ content: '❌ ليس لديك الصلاحية لاستخدام هذا الأمر.', ephemeral: true });
    }
    const url = interaction.options.getString('url');
    try {
      await client.user.setAvatar(url);
      await interaction.reply('✅ تم تغيير صورة البوت بنجاح!');
    } catch (error) {
      console.error(error);
      await interaction.reply('❌ حصل خطأ أثناء تغيير الصورة (تأكد أن الرابط صحيح).');
    }
  }

  else if (interaction.commandName === 'sharepg') {
    if (!interaction.member.roles.cache.has(allowedRoleId)) {
      return interaction.reply({ content: '❌ ليس لديك الصلاحية لاستخدام هذا الأمر.', ephemeral: true });
    }

    const url = interaction.options.getString('url');
    const user = interaction.options.getUser('user');

    let type = null;
    if (url.includes('tiktok.com')) type = 'tiktok';
    else if (url.includes('youtube.com') || url.includes('youtu.be')) type = 'youtube';
    else if (url.includes('facebook.com')) type = 'facebook';

    if (!type) {
      return interaction.reply('❌ الرابط لازم يكون YouTube أو TikTok أو Facebook.');
    }

    const entry = { url, userId: user.id };
    data[type].push(entry);
    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));

    // تحديث الايمبد الرئيسي
    await updateMainEmbed();
    await interaction.reply('✅ تم إضافة الصفحة بنجاح!');
  }

  else if (interaction.commandName === 'deletepg') {
    if (!interaction.member.roles.cache.has(allowedRoleId)) {
      return interaction.reply({ content: '❌ ليس لديك الصلاحية لاستخدام هذا الأمر.', ephemeral: true });
    }

    const url = interaction.options.getString('url');
    let found = false;
    ['youtube', 'tiktok', 'facebook'].forEach(type => {
      const before = data[type].length;
      data[type] = data[type].filter(e => e.url !== url);
      if (before !== data[type].length) found = true;
    });

    if (!found) {
      return interaction.reply('❌ لم يتم العثور على الصفحة بهذا الرابط.');
    }

    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));

    // تحديث الايمبد الرئيسي
    await updateMainEmbed();
    await interaction.reply('✅ تم حذف الصفحة وتحديث الرسالة بنجاح!');
  }

  else if (interaction.commandName === 'pages') {
    const target = interaction.options.getUser('user');

    const youtubePages = data.youtube.filter(e => e.userId === target.id);
    const tiktokPages = data.tiktok.filter(e => e.userId === target.id);
    const facebookPages = data.facebook.filter(e => e.userId === target.id);

    const youtubeText = youtubePages.length
      ? youtubePages.map(e => `[صفحته على YouTube](${e.url})`).join('\n')
      : 'لا يوجد';
    const tiktokText = tiktokPages.length
      ? tiktokPages.map(e => `[صفحته على TikTok](${e.url})`).join('\n')
      : 'لا يوجد';
    const facebookText = facebookPages.length
      ? facebookPages.map(e => `[صفحته على Facebook](${e.url})`).join('\n')
      : 'لا يوجد';

    const embed = new EmbedBuilder()
      .setTitle(`📣 الصفحات الخاصة بـ ${target.username}`)
      .setColor(0x00AEFF)
      .addFields(
        { name: '📺 YouTube', value: youtubeText, inline: false },
        { name: '🎵 TikTok', value: tiktokText, inline: false },
        { name: '📘 Facebook', value: facebookText, inline: false },
      )
      .setThumbnail(target.displayAvatarURL())
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
});

// تحديث الايمبد الرئيسي
async function updateMainEmbed() {
  const youtubeText = data.youtube.length
    ? data.youtube.map(e => `[صفحته على YouTube](${e.url}) (<@${e.userId}>)`).join('\n')
    : 'لا يوجد';
  const tiktokText = data.tiktok.length
    ? data.tiktok.map(e => `[صفحته على TikTok](${e.url}) (<@${e.userId}>)`).join('\n')
    : 'لا يوجد';
  const facebookText = data.facebook.length
    ? data.facebook.map(e => `[صفحته على Facebook](${e.url}) (<@${e.userId}>)`).join('\n')
    : 'لا يوجد';

  const embed = new EmbedBuilder()
    .setTitle('📣 الصفحات المشتركة')
    .setColor(0x00AEFF)
    .addFields(
      { name: '📺 YouTube', value: youtubeText, inline: false },
      { name: '🎵 TikTok', value: tiktokText, inline: false },
      { name: '📘 Facebook', value: facebookText, inline: false },
    )
    .setTimestamp();

  const channel = await client.channels.fetch(CHANNEL_ID);
  if (data.messageId) {
    const message = await channel.messages.fetch(data.messageId);
    await message.edit({ embeds: [embed] });
  } else {
    const sent = await channel.send({ embeds: [embed] });
    data.messageId = sent.id;
    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
  }
}

// تشغيل البوت
client.login(TOKEN);