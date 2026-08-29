package corechat;

import java.util.ArrayList;
import java.util.InputMismatchException;

import static corechat.ChatApplication.scanner;

public class ChatService {

    private User currentUser;
    private ArrayList<User> users;
    private MessageManager messageManager;


    public ChatService(User currentUser, ArrayList<User> users, MessageManager messageManager) {
        this.currentUser = currentUser;
        this.users = users;
        this.messageManager = messageManager;
    }

    public void chats() {


        if (users.size() <= 1) {
            System.out.println("No other users available");
            return;
        }

        int count = 1;
        for (int i = 0; i < users.size(); i++) {

            if (users.get(i) == currentUser) {
                continue;
            }
            System.out.println(count + "." + users.get(i).getUserName());
            count++;
        }

        boolean valid = false;
        int choice = 0;
        while (!valid) {
            try {
                System.out.print("\nEnter your choice : ");
                choice = scanner.nextInt();
                scanner.nextLine();
                System.out.println();

                valid = true;

            } catch (InputMismatchException e) {

                System.out.println("Invalid number \n");
                scanner.nextLine();
            }
        }
        count = 1;

        User selectedUser = null;

        for (int i = 0; i < users.size(); i++) {
            if (users.get(i) == currentUser) {
                continue;
            }
            if (count == choice) {
                selectedUser = users.get(i);
                break;
            }
            count++;
        }

        if (selectedUser != null) {
            for (int i = 0; i < messageManager.getMessages().size(); i++) {

                Message message = messageManager.getMessages().get(i);

                if (
                        (message.getSender() == currentUser
                                && message.getReceiver() == selectedUser)
                                ||
                                (message.getSender() == selectedUser
                                        && message.getReceiver() == currentUser)
                ) {

                    System.out.println(
                            message.getSender().getUserName() + " : " + message.getMessage());
                }
            }


            System.out.print("\nEnter message : ");
            String messageText = scanner.nextLine();
            System.out.println();

            Message message = new Message(currentUser, selectedUser, messageText);
            messageManager.storeMessages(message);

            System.out.println("Message sent successfully ! \n");
        } else {
            System.out.println("Invalid user choice !!");
        }


    }
}



