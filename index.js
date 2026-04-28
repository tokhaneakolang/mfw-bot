const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const express = require('express');
const cors = require('cors');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const app = express();
app.use(cors());
app.use(express.json());

const ratings = new Map();

app.get('/health', (req, res) => res.json({ status: 'online' }));

app.post('/webhook', async (req, res) => {
    try {
        const { embed, channelId } = req.body;
        const channel = await client.channels.fetch(channelId || process.env.CHANNEL_ID);
        if (!channel) return res.status(404).json({ success: false });
        
        const discordEmbed = new EmbedBuilder().setTitle(embed.title || '📢 New Message').setColor(embed.color || 0xff4444).setTimestamp(new Date());
        if (embed.fields) embed.fields.forEach(f => discordEmbed.addFields({ name: f.name, value: f.value, inline: f.inline || false }));
        if (embed.image?.url) discordEmbed.setImage(embed.image.url);
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`rate_temp_1`).setLabel('⭐1').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`rate_temp_2`).setLabel('⭐2').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`rate_temp_3`).setLabel('⭐3').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`rate_temp_4`).setLabel('⭐4').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`rate_temp_5`).setLabel('⭐5').setStyle(ButtonStyle.Primary)
        );
        
        const sentMessage = await channel.send({ embeds: [discordEmbed], components: [row] });
        const updatedRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`rate_${sentMessage.id}_1`).setLabel('⭐1').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`rate_${sentMessage.id}_2`).setLabel('⭐2').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`rate_${sentMessage.id}_3`).setLabel('⭐3').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`rate_${sentMessage.id}_4`).setLabel('⭐4').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`rate_${sentMessage.id}_5`).setLabel('⭐5').setStyle(ButtonStyle.Primary)
        );
        await sentMessage.edit({ components: [updatedRow] });
        ratings.set(sentMessage.id, { ratings: [] });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    const parts = interaction.customId.split('_');
    if (parts[0] === 'rate') {
        const messageId = parts[1];
        const rating = parseInt(parts[2]);
        const data = ratings.get(messageId);
        if (!data) return interaction.reply({ content: '❌ Not found', ephemeral: true });
        if (data.ratings.find(r => r.userId === interaction.user.id)) return interaction.reply({ content: '❌ Already rated', ephemeral: true });
        data.ratings.push({ userId: interaction.user.id, rating });
        const avg = (data.ratings.reduce((s, r) => s + r.rating, 0) / data.ratings.length).toFixed(1);
        await interaction.reply({ content: `✅ Rated ${rating}⭐! Avg: ${avg}/5 (${data.ratings.length} ratings)`, ephemeral: true });
        const channel = await client.channels.fetch(interaction.channelId);
        const msg = await channel.messages.fetch(messageId);
        if (msg && msg.embeds[0]) {
            const fields = [...msg.embeds[0].fields];
            const idx = fields.findIndex(f => f.name === '⭐ Rating');
            if (idx !== -1) fields[idx] = { name: '⭐ Rating', value: `⭐ ${avg}/5 (${data.ratings.length} ratings)`, inline: false };
            else fields.push({ name: '⭐ Rating', value: `⭐ ${avg}/5 (${data.ratings.length} ratings)`, inline: false });
            const newEmbed = EmbedBuilder.from(msg.embeds[0]).setFields(fields);
            await msg.edit({ embeds: [newEmbed] });
        }
    }
});

client.once('ready', () => console.log(`✅ Bot online as ${client.user.tag}`));
app.listen(3000, () => console.log('✅ API on port 3000'));
client.login(process.env.DISCORD_BOT_TOKEN);
