package corechat;

import java.util.ArrayList;

public class MessageManager {

   private ArrayList<Message> messages = new ArrayList<>();

    public void storeMessages(Message message) {
        messages.add(message);
    }

    public ArrayList<Message> getMessages(){
        return messages;
    }

}



