const Conversation = require("../models/conversation");

const saveMessage = async (userId, conversationID, sender, message, topic) => {
	try {
		const id = conversationID.trim()
		let conversation = await Conversation.findOne({ userId, conversationID: id });
		if (conversation) {
			conversation.messages.push({ sender, message });
		}
		else {
			conversation = new Conversation({
				userId,
				conversationID,
				messages: [{ sender, message }],
				topic
			});
		}
		await conversation.save();
	} catch (error) {
		console.error("Error saving message:", error);
		throw error;
	}
};

const getConversationByID = async (userId, conversationID) => {
	try {
		const conversation = await Conversation.findOne({ userId, conversationID: conversationID });
		return conversation ? conversation.messages : [];
	} catch (error) {
		console.error("Error fetching conversation:", error);
		throw error;
	}
};

const getConversationsByUser = async (userId) => {
    try {
        const conversations = await Conversation.find({ userId }, { messages: 0 }).lean();
        return conversations;
    } catch (error) {
        console.error("Error fetching conversations by user:", error);
        throw error;
    }
};

const deleteConversationByID = async (userId, conversationID) => {
	try {
		const result = await Conversation.deleteOne({ userId, conversationID: conversationID });
		return result;
	} catch (error) {
		console.error("Error deleting conversation:", error);
		throw error;
	}
};

const clearAllConversations = async (userId) => {
	try {
		const result = await Conversation.deleteMany({ userId });
		return result;
	} catch (error) {
		console.error("Error clearing all conversations:", error);
		throw error;
	}
};

module.exports = { saveMessage, getConversationsByUser, getConversationByID, deleteConversationByID, clearAllConversations };

