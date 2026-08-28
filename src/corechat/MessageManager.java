package corechat;

import java.util.ArrayList;

public class MessageManager {

    ArrayList<Message> messages = new ArrayList<>();

    public void storeMessages(Message message) {
        messages.add(message);
    }


}



